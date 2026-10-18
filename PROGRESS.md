# PROGRESS

## Last updated
2026-10-18 by the BUILDER (Claude Code)

## Current phase
**Phase 5: P0 polish + release candidate.** Release candidate built and tested locally. **HUMAN CHECKPOINT: Maris deploys to Vercel** (see below). P0 DONE needs the §G1 checklist re-run on the live URL.

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
- [x] Bot recovers in 10/10 scripted off-stage launches (was 9/10 until the grounded-flicker fix)
- [x] 60 fps measured: 60.6–60.7 fps in Chromium with the GPU on. Without the GPU (software WebGL) it was 9 fps; baking the static art into textures fixed the per-frame cost.
- [x] Keyboard verified with real KeyboardEvents (D moved 186 px in 0.5 s, W jumped ≈200 px, J punched). The browser pane's synthetic keys omit `keyCode`, so test with a real keyboard.
- [x] **FUN GATE (HARD), HUMAN CHECKPOINT: PASSED.** Maris played 5 matches (2026-10-18): "Yes, I'd press rematch."

## Phase 4: mutant gameplay
4A and 4B were built together: **no gene falls back to its default** (`IMPLEMENTED` sets in `src/arena/kit.ts` are complete; the unit test asserts it). Architecture: `kit.ts` (genes → numbers, pure, unit-tested), `moves.ts` (specials/close moves), `entities.ts` (projectiles, zones, frogs), `modifiers.ts`, one damage pipeline in `ArenaScene.hit()`. The bot uses its mutant's real moves (Easy/Normal/Hard ability use 12/35/65%), and GUARD bots block.

### Every gene: how it was verified (`tests/e2e/genes.spec.ts`, `genes2.spec.ts`, real production build)
- Eyes: SPIT hit 6% · BEAM hit 9% (telegraphed 0.3 s charge, colour from trait) · CHAOS ORB hit 7% (seeded bounces) · TEARS left 2 puddles · LEECH hit 8% and healed · BLINK teleported 246 px · RAGE buff active
- Head: ROYAL launched less than LIGHTWEIGHT (632 vs 854 px/s, same hit) · WARP recovery teleported 191 px up · HORNS recovery hit 7% · GUARD blocked 70% (2.1% of 7%) · LIGHTWEIGHT faster/flies further · STEADY baseline
- Mouth: HEADBUTT 7% · PUKE 10% (multi-hit) · HONK 3% + stun · COIN TOSS 7% · DROOL puddle · BUBBLE shield active (blocked a beam: 0%)
- Body: LIGHT ran further than HEAVY in 0.7 s (572 vs 515) · FLOATY/DASHER/SLIPPERY via kit profile (unit test)
- Base: UNDEAD revived without losing a life, second KO costs a life · TOXIC aura damage over time · ANOMALY special cooldown ×0.85 (unit test) · NORMAL
- Accessory: SHIV punch 3.5% vs 3% · FWOG frog spawned and hit · PUMP grew · DUMP shrank · REGEN healed · CHARM cosmetic
- Aura: BURN dash left fire · FROST slowed target · GUST pushed opponent · SMOKE puff + hidden · SHOCK combo ender +200 ms stun · SHIELD first hit halved (3.5% of 7%) · BLOOM healed · GLOW cosmetic
- METAL skin: +0.1 weight (unit test)

### P0 recipes (all playable from TRY A SECRET MUTATION)
KING BEAM pierces a bubble (9% vs 0%) · NUCLEAR UNDEAD revive burst 8% · THE NAKED KING hold I 1 s → super armor · ARCHMAGE warp leaves a rune · VOLATILITY pulses every 5 s · FWOG LORD 2 frogs · ESCAPE VELOCITY third jump before recovery · WILDFIRE beam leaves fire

### P0 modifiers (telegraph · effect · counterplay)
- TOXIC FLOOR: segment flickers 1.5 s before arming · 1 dmg / 0.5 s for 3 s (3% measured) · step off or stand on a floating platform; rotates
- SLIPPERY FLOOR: platform turns icy blue · ground friction ×0.3 · short taps, dash to stop
- LOW GRAVITY: listed pre-match and in the HUD · gravity ×0.7 (verified) · fast-fall with S
- UNSTABLE KNOCKBACK: listed pre-match/HUD (⚠) · knockback ×1.35 (verified) · keep damage low, recover early
- No modifier → "STABLE… FOR NOW"; unimplemented P1 modifiers are never listed.

### Acceptance
- [x] Every gene has a visible effect (above)
- [x] Changing one parent changes the mutant and its gameplay: kit/moves differ per pair (pre-match move list; e.g. 18×66 KING BEAM BEAM/ROYAL/SLIPPERY/SHIELD vs today's opponent BLINK/STEADY/BALANCED/GLOW)
- [x] Each P0 modifier: telegraph, effect, counterplay (above)
- [x] Balance smoke test PASSES. Run 1 (200 matches, seed 143) passed the rule but showed UNDEAD 11/11, LEECH 76%, ROYAL/HORNS 75%, FROST 72% (n < 30) and FLOATY/GUST/GUARD weak. Tuned values (UNDEAD revive 60→90%, FROST slow 20%/1 s → 15%/0.8 s, LEECH heal 50→35%, ROYAL 0.85→0.9, HORNS 7→6 dmg, FLOATY gravity 0.7→0.8, GUST stronger, DROOL puddle wider, bot uses GUARD).
- [x] Recipe detection order-independent (unit tests); every P0 recipe playable from TRY A SECRET MUTATION

### Balance run 2 (300 headless matches, seed 2026, both bots Normal, real mutants + real modifiers): PASS
No gene with n ≥ 30 above 65% (highest: ROYAL and SHIELD at 64.7%). Known skew: bot-vs-bot matches almost always reach the 120 s timer (avg 118.7 s), so damage-reducing and healing genes (LEECH, REGEN, BLOOM, TOXIC, SHIELD) are favoured in time-outs; the weakest are DROOL 29%, FLOATY 32%, RAGE 36%. Watch in human play. `npx playwright test tests/e2e/balance.spec.ts` regenerates `test-results/balance.md`.

| Slot | Gene | n | Wins | Win rate |
|---|---|---|---|---|
| affinity | TOXIC | 10 | 8 | 80.0% |
| special | LEECH | 25 | 18 | 72.0% |
| trinket | REGEN | 10 | 7 | 70.0% |
| affinity | UNDEAD | 19 | 13 | 68.4% |
| element | BLOOM | 29 | 19 | 65.5% |
| head | ROYAL | 34 | 22 | 64.7% |
| physics | SLIPPERY | 17 | 11 | 64.7% |
| element | SHIELD | 51 | 33 | 64.7% |
| special | SPIT | 208 | 129 | 62.0% |
| close | BUBBLE | 51 | 31 | 60.8% |
| physics | DASHER | 12 | 7 | 58.3% |
| element | GUST | 33 | 19 | 57.6% |
| close | HEADBUTT | 345 | 189 | 54.8% |
| element | SMOKE | 24 | 13 | 54.2% |
| head | HORNS | 24 | 13 | 54.2% |
| trinket | PUMP | 13 | 7 | 53.8% |
| close | PUKE | 49 | 26 | 53.1% |
| close | HONK | 17 | 9 | 52.9% |
| trinket | FWOG | 21 | 11 | 52.4% |
| special | CHAOS_ORB | 58 | 30 | 51.7% |
| trinket | NONE | 467 | 238 | 51.0% |
| physics | BALANCED | 507 | 257 | 50.7% |
| element | BURN | 96 | 48 | 50.0% |
| trinket | SHIV | 10 | 5 | 50.0% |
| affinity | NORMAL | 568 | 278 | 48.9% |
| head | GUARD | 33 | 16 | 48.5% |
| head | STEADY | 471 | 228 | 48.4% |
| element | GLOW | 138 | 65 | 47.1% |
| head | WARP | 30 | 14 | 46.7% |
| element | FROST | 54 | 25 | 46.3% |
| element | NONE | 153 | 69 | 45.1% |
| physics | HEAVY | 41 | 18 | 43.9% |
| special | BEAM | 88 | 37 | 42.0% |
| element | SHOCK | 22 | 9 | 40.9% |
| trinket | CHARM | 69 | 28 | 40.6% |
| trinket | DUMP | 10 | 4 | 40.0% |
| special | BLINK | 119 | 47 | 39.5% |
| special | TEARS | 74 | 29 | 39.2% |
| close | COIN_TOSS | 69 | 25 | 36.2% |
| special | RAGE | 28 | 10 | 35.7% |
| physics | FLOATY | 19 | 6 | 31.6% |
| close | DROOL | 69 | 20 | 29.0% |

### Bugs found and fixed in Phase 4
- Grounded flicker: Arcade only flags contact on frames with a collision step, so a resting fighter sometimes read as airborne. That cancelled GUARD and puddles and occasionally jump resets. Fixed with a geometric ground check; bot recovery went from 9/10 to 10/10.
- Headless sims crashed baking textures (no renderer); baked art is now skipped in headless mode.

## Phase 5: P0 polish + release candidate
Done:
- **Performance:** Phaser is lazy-loaded only for the arena (prefetched on reveal/pre-match). Main bundle 1.7 MB → 210 KB (71 KB gzip); grid loads 96 px thumbs only; arena 60 fps.
- **Error states:** React error boundary per screen ("THE EXPERIMENT MALFUNCTIONED" + BACK TO THE LAB, never a stack trace); archive load failure → RETRY; malformed records dropped; missing art → fallback; bad deep links → friendly message.
- **Accessibility:** skip link, visible focus on all controls, aria labels (arena, mute, canvases), reduced motion (1 s reveal crossfade, ¼ screen shake), controls shown before every fight, "Best on desktop with a keyboard" on touch devices.
- **Look:** screen transitions, code-drawn favicon, OG/Twitter share image from real sprites (`scripts/build-og.ts` → `public/og.png`), meta tags, `vercel.json` with long caching for art.
- **Critical-flow e2e** (`tests/e2e/critical.spec.ts`, production build), all pass: home → lab → A → B → splice → reveal → fight → forced KO ×2 → results → notebook (W 1 – L 0, survives refresh) with no console errors · malformed metadata record · missing image · all external network blocked (0 Monad RPC calls in the guest flow) · archive 500 → retry · 375 px on home, reveal and pre-match.

- [ ] §G1 P0 Definition of Done on the **live URL** (after the deploy)
- [x] Playwright critical flow + failure cases pass against the production build (locally)
- [x] No console errors in the full guest flow

## Broken
- Nothing known. Note: a full e2e run during which the PC slept took 3.3 h and timed out 2 tests; both pass when rerun.

## Blockers
- HUMAN CHECKPOINT: Vercel production deploy (Maris).

## What Maris must do (deploy)
1. Push the repo to GitHub (`git remote add origin <your repo URL>` then `git push -u origin main`).
2. Vercel → Add New → Project → import the repo → Deploy (settings come from `vercel.json`; no env vars needed).
3. Open the live URL: home → ENTER THE LAB → splice two Chogs → FIGHT.
4. Paste the production URL to the Builder. The Builder then makes the og:image URL absolute and runs the §G1 checklist against the live site.

## Next
- After the deploy: §G1 on the live URL → P0 DONE → Phase 6 (P1: wallet + MY CHOGS, Recorded Splice if the registry is deployed, share card, local 2P, P1 recipes/modifiers).


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
- **P-1, mutant art matches the genes:** §D6 picks the top/bottom parent of the art from the "visual" stream, independent of inheritance. So a KING BEAM can show parent A's wizard hat while the gene table says the head (Crown) came from parent B. Proposal: put the parent that gave the inherited **Head** on top (fall back to the visual stream when Head is `none`), so the picture matches "from #A / from #B". Needs Maris's OK because it changes §D6 wording.

## Do not touch
- `contracts/**`, `docs/REVIEW.md`, `docs/SECURITY.md`, `tests/review/**` (Reviewer-owned)
- `../chog-hearth/` (an unrelated project)
