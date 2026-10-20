# DECISIONS

## 2026-10-18 — Phase 0

- **Repo location:** `C:\Chogathon\chog-break` (the sibling `chog-hearth/` is an unrelated pre-existing project; untouched).
- **Pinned versions (checked with `npm view`):** react/react-dom 18.3.1, phaser 3.90.0 (latest 3.x; spec fixes Phaser 3 — 4.x exists but is out of stack), viem 2.57.7, vite 6.4.4 + @vitejs/plugin-react 4.7.0, vitest 3.2.7, typescript 5.9.3, eslint 9.39.5, typescript-eslint 8.71.2, prettier 3.9.10, tsx 4.23.15, sharp 0.35.5, @playwright/test 1.64.1.
- **No virtualization library:** the collection grid will use a small hand-rolled windowed grid to avoid an extra dependency (§B minimal deps).
- **Single tsconfig, `noEmit`:** `typecheck` = `tsc -p tsconfig.json`; Vite does the emit.
- **Core purity enforced twice:** ESLint restrictions on `src/core/**` and `tests/unit/core-purity.test.ts`.
- **Minted-set proof via `ownerOf`, not logs:** the public RPC rejects `eth_getLogs` ranges above ~100 blocks at block ~114.3M (see CHAIN_CHECK.md), so scanning `Transfer` from genesis is impractical. `ownerOf` over 0..2100 via Multicall3: exactly 1..1969 succeed. Written to `public/data/valid-token-ids.json`.
- **IPFS gateway order:** filebase first. pinata, ipfs.io and dweb.link returned HTTP 429 under bulk fetching on 2026-10-18; filebase returned 200. Still marked UNVERIFIED (a third-party service).
- **sfc32 warm-up:** after seeding, sfc32 discards its first 12 outputs (deterministic, part of CORE_VERSION 1).
- **Power budget values:** specials and close moves score 0 (every mutant has exactly one of each). Passive edges (ROYAL/GUARD/WARP/HORNS, UNDEAD/TOXIC/ANOMALY, active trinkets, active elements) score +1. LIGHT scores −1. A recipe adds +1. Range −1..+5, inside the spec's [−2, +5].
- **Recipes pin their ingredients:** when a recipe matches, the slots in its condition are taken from the parent that satisfied them (e.g. KING BEAM: Eyes from the laser parent, Head from the crown parent). The gene bits are still drawn, so the stream stays stable. This keeps the perk meaningful and the reveal readable. When both orderings match, the lo parent is x.
- **P1 recipes are defined but disabled** (`recipeTiers` defaults to `['P0']`) until their perks exist, so an unimplemented recipe name is never shown.
- **Sprite survey (§D6, 25 sources: 5 each of Origin, Skull, Radioactive, 1:1, Naked):** every source is 1000×1000. Each is a head-and-shoulders bust that fills the canvas edge to edge, not a full-body figure on empty space. Rough vertical regions: hat/head top 0–30%, eyes 35–45%, mouth 50–60%, shoulders/body 60–100%. Backgrounds are either flat colour (flood fill removes them) or splashy/patterned edge-to-edge art (kept). Radioactive and 1:1 tokens are mostly patterned. Result: bgRemoved on 1,295/1,969. A 40–60% seam therefore splits "hat + eyes" from "mouth + body", which reads well.
- **Specimen jar:** if either parent kept its background, the mutant is clipped to a rounded jar with a glass outline (reveal, pre-match and arena), so no square background blocks.
- **Sprite size:** 41.7 MB actual bytes (256 px ≈ 33 MB at webp q68, thumbs ≈ 8.6 MB at q60), just over the 40 MB target. Only thumbs load in the grid; accepted. (`du` on Windows over-reports because of cluster size.)
- **Arena renders static art once:** the background, grid, tanks and scanlines are baked into textures. Software WebGL showed 9 fps with per-frame Graphics; baked textures + GPU run at 60 fps.
- **Arena keeps Arcade Physics (§B):** headless checks run in Playwright through `?test=1` hooks rather than a custom physics sim.
- **$CHOG is an EIP-1167 minimal proxy** (45-byte runtime) → implementation `0x7f64ccfeb3e3afd7691ea0ef404e947786cefae8`. The implementation bytecode contains the `burn(uint256)` and `burnFrom(address,uint256)` selectors (heuristic scan only, verified source not read). Per spec the registry keeps sending 10% to the dead address; switching to `burn()` is a Reviewer proposal + STOP 5 for Maris.

## 2026-10-18 — Phase 6

- **P1 order changed by Maris:** game features first (2P, P1 modifiers, P1 recipes, share card); wallet/Recorded Splice after; Vercel deploy last ("the main thing is a working game").
- **All 16 recipes live:** `recipeTiers` defaults to P0+P1 in core. P0 recipes are listed first, so they still win ties. The 20-pair stability snapshot did not change.
- **Live stage edges:** SHRINKING STAGE moves the main platform's edges at runtime; `groundAt`, the bot and UNDEAD revive read the live edges (`ArenaScene.edges`).
- **Input buffering:** keyboard presses are queued from keydown and consumed on the next read (no lost taps; presses during hitstop fire right after).
- **2P notebook rule:** local 2P matches don't change the mutant's W–L record (the record is "your mutant vs the lab bot").
- **Lethality tuning (polish pass):** `KNOCKBACK.unit` 1.2 and `TUNING.hitstunDrag` 420. Measured with the headless sim (Hard bots, 20 matches): lives lost per 120 s went 0.85 → 1.8. The "no unavoidable kill below ~60%" rule is checked physically: travel = vx² / (2 · drag) < 840 px for every base move at 60% on a weight-1 target.
- **HUD as an overlay scene:** a zooming arena camera would scale and move a same-scene HUD, so the HUD is a separate Phaser scene launched alongside the arena.

## 2026-10-19

- **P-1 approved → CORE_VERSION 2:** §D6 picked the art's top parent from the "visual" stream; Maris approved putting the parent that gave the inherited **Head** on top, so the picture matches the reveal labels. The visual-stream bit is still drawn (the stream is identical in v1 and v2); when neither parent has a Head the stream decides. `createMutant({ version: 1 })` reproduces v1 output exactly, per §D3 ("bump CORE_VERSION and keep v1 reproducible"). Genes, names, recipes and arena rules are unchanged between versions.
- **2.5D arena approved (Maris, 2026-10-19):** asked about 3D; after the trade-offs (§A6 lists 3D as out of scope; real 3D movement can't be solid by the freeze) Maris chose a **2.5D arena**: three.js (`three@0.186.1`, new dependency, approved) renders the stage, lighting and camera in 3D while gameplay stays on the 2D plane with the existing Phaser physics, genes, bot and tests. The current 2D arena stays as the fallback (`?arena=2d`, no WebGL, headless sims).
- **CHAOS ORB toned down:** 7 → 6 damage per hit, 4 → 3 bounces. The 300-match sim had it at 72.4% (limit 65%); now 58.6%.
- **Headless sim made deterministic:** the 300-match balance sim gave different results for the same seed (CHAOS ORB 55–72%, ROYAL up to 68%), so it passed or failed by chance. Causes: (1) Phaser's scene clock starts at `game.loop.time` (the real browser clock) while the sim steps from 0, so timers set in `create()` depended on wall time; the sim now zeroes the loop clock. (2) Without a rig, landing squash scaled the physics sprite with a Phaser tween, and tweens run on `Date.now()`; squash is skipped when there is no renderer (purely cosmetic). (3) The CHAOS ORB bounce seed was a global counter carried across matches; reset per match. Same seed → identical results in the same page and across pages. CHAOS ORB cooldown also 4.0 → 4.5 s.
- **Gameplay-rule e2e suites use `?arena=2d`:** with the 3D stage and fighters, the extra per-frame rendering made the gene and recipe-perk checks (which read results after real-time waits) intermittently read too early. Game rules are identical in both arenas, so `genes`, `genes2` and the P1 recipe-perk tests run on the 2D arena. The 3D arena keeps its own coverage: alignment, frame rate, full match, rematch ×10, P1 modifiers, local 2P and the critical flow.

## 2026-10-20

- **Recorded Splice approved; Builder writes the registry (Maris):** asked what the wallet is for, Maris chose (1) Recorded Splice and (2) small holder perks. With no Reviewer session active, Maris assigned `contracts/` (ChogBreakRegistry.sol, Foundry tests, Deploy script, DEPLOY.md) to the Builder. The Builder never deploys: Maris reviews and signs the deploy with her own keystore (STOP 5). Until a deployed address is in `src/config/chain.ts`, no Recorded Splice UI is shown.
