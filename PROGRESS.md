# PROGRESS

## Last updated
2026-10-18 by the BUILDER (Claude Code)

## Current phase
**Phase 3: base fight. Waiting on the FUN GATE (HUMAN CHECKPOINT).** Phases 0–2 are done apart from the sprite download, which is finishing.

## Phase 0: setup, facts, data
- [x] `npm run build`, `typecheck`, `lint` and `test` pass
- [x] `docs/CHAIN_CHECK.md`: every automatable §C2 row passes. MANUAL rows: $CHOG burn source, fee-on-transfer (Reviewer fork test), explorer docs.
- [x] `public/data/chogs.json`: 1,969 records, validated against §C3 (tiers, presence counts, distinct raw values). §C3 counts raw spellings: Head has 66 raw values and 64 normalized ('Boob Cap'/'BOOB Cap', 'JEET Cap'/'Jeet Cap'). `docs/TRAIT_REPORT.md` generated.
- [x] Sprites: all 1,969 built (256 px + 96 px thumbs), 41.7 MB, bgRemoved 1,295/1,969; others framed in a specimen jar

## Phase 1: deterministic core (done)
- [x] Every real trait value maps to exactly one gene per slot. The gene distributions on the real manifest equal the §D4 counts exactly.
- [x] createMutant(A,B) deep-equals createMutant(B,A) for 1,000 seeded pairs; 20-pair snapshot on real data
- [x] pairKey vectors created (`tests/fixtures/pairkey-vectors.json`); Vitest parity passes (Foundry side: Reviewer)
- [x] Power budget over all 3.6M combinations (range −1..+5); Tier never affects stats
- [x] All 16 recipe pair counts equal the spec exactly; `docs/RECIPE_EXAMPLES.md`; 8 P0 pairs power TRY A SECRET MUTATION
- [x] Core purity (lint rule + test)

## Phase 2: the Lab (done, except compositor tuning)
- [x] Playwright: home → lab → pick A → pick B → splice → reveal → notebook, no console errors (`tests/e2e/lab.spec.ts`, 6 tests)
- [x] Same deep link → identical mutant after reload and in a second browser context, also with A/B reversed
- [x] Lab usable at 375 px (no horizontal scroll); missing art shows the fallback, no crash
- [x] Reveal shows "from #A / from #B" and the gene for every inherited slot
- [x] 25-sprite survey recorded in DECISIONS.md; specimen jar added for kept backgrounds

## Phase 3: base fight
Built: Phaser 3 arena (Arcade Physics), 1280×720 logical stage, main platform plus 3 pass-through platforms, blast zones 200 px out, move / jump / double jump / recovery / drop-through / fast fall, 3-hit punch combo, dash attack, damage %, knockback formula (§D7) with cap, hitstun, hitstop, hit flash, particles, knockback trail, screen shake on big hits, floating damage numbers, squash and stretch, run lean, synthesized fight SFX, 2 lives, 2 s respawn invulnerability, 120 s timer, time-out rules and sudden death at 150%, HUD, results (winner, KOs, damage dealt, time), rematch, Change parent, New experiment, notebook W–L. Bot: FSM (APPROACH/ATTACK/SPACE/RECOVER/EDGEGUARD) with Easy/Normal/Hard reaction times of 400/220/110 ms. Default opponent: a pair seeded by the UTC date.
- [x] Full match vs Normal bot → results; rematch ×10 with fresh state, one canvas, no errors (`tests/e2e/arena.spec.ts`)
- [x] Lives drop exactly once per KO (unit test on `applyKO` + e2e: lingering outside the blast zone costs one life)
- [x] Bot recovers in 9/10 scripted off-stage launches (meets the bar but borderline; will harden in Phase 4)
- [x] 60 fps measured: 60.6–60.7 fps in Chromium with the GPU on. Without the GPU (software WebGL) it was 9 fps; baking the static art into textures fixed the per-frame cost.
- [x] Keyboard verified with real KeyboardEvents (D moved 186 px in 0.5 s, W jumped ≈200 px, J punched). The browser pane's synthetic keys omit `keyCode`, so test with a real keyboard.
- [ ] **FUN GATE (HARD), HUMAN CHECKPOINT:** Maris plays 5 matches and answers "would I press rematch?". Verdict goes here.

## Broken
- Nothing known.

## Blockers
- FUN GATE needs Maris (see "What Maris must do").

## Next
- After the FUN GATE: Phase 4A (high-traffic genes, P0 modifiers, P0 recipe perks).

## What Maris must do (FUN GATE)
1. In the project folder run `npm run dev` and open http://localhost:5173
2. ENTER THE LAB → pick any two Chogs → SPLICE → FIGHT ▸ → FIGHT ▸
3. Play 5 matches (try Easy, Normal, Hard). Controls: A/D move, W jump (press three times in the air for recovery), S drop, J punch, K dash.
4. Tell the Builder: would you press rematch? What felt bad (too floaty, too slow, bot too hard or easy, hits not punchy)?

## Unverified facts (all in `src/config/chain.ts`)
- RPC URL works but is not yet confirmed in the official Monad docs.
- Multicall3 has code at the canonical address and multicall calls succeed (functionally verified).
- IPFS gateways are third-party: filebase works; pinata, ipfs.io and dweb.link return 429 under load.
- `eth_getLogs` works for a 100-block range and fails at 1,000.
- Block explorer and contract verification method: not yet read from the official docs.

## Needs human verification
- $CHOG `burn()`: the implementation bytecode contains the selectors, but the source was not checked. The spec still uses the dead address.
- $CHOG fee-on-transfer: needs the Reviewer fork test.
- FUN GATE verdict.

## Proposals
- **P-1, mutant art matches the genes:** §D6 picks the top/bottom parent of the art from the "visual" stream, independent of inheritance. So a KING BEAM can show parent A's wizard hat while the gene table says the head (Crown) came from parent B. Proposal: put the parent that gave the inherited **Head** on top (fall back to the visual stream when Head is `none`), so the picture matches "from #A / from #B". Needs Maris's OK because it changes §D6 wording.

## Do not touch
- `contracts/**`, `docs/REVIEW.md`, `docs/SECURITY.md`, `tests/review/**` (Reviewer-owned)
- `../chog-hearth/` (an unrelated project)
