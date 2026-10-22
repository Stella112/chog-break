# PROGRESS

## Last updated
2026-10-19 by the BUILDER (Claude Code)

## Current phase
**Phase 6/7: P1 game features done + submission package drafted.** (Maris, 2026-10-18: "the main thing is a working game"; deploy is the last step). Done: local 2P, 6 P1 modifiers, 8 P1 recipes, share card. Wallet connect + MY CHOGS holder mode built (read-only, 2026-10-19). Not started: Recorded Splice (needs the Reviewer's registry). Vercel deploy deferred to the end.

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

## Phase 6: P1 (game features first)
- [x] **Local 2P:** VS BOT / LOCAL 2P switch on pre-match; P2 plays today's opponent mutant with ←/→/↑/↓ , . / M; pre-match shows both control columns; results say "PLAYER N WINS"; 2P matches don't touch the notebook W–L. Verified with real key events: both fighters moved at the same time (181 px / 174 px).
- [x] **6 P1 modifiers** (all with telegraph · effect · counterplay; `tests/e2e/p1.spec.ts`): OVERCLOCK (+20% speed for both) · BOUNCY FLOOR (pink edge; hard landings bounce, hold S to stick) · SHRINKING STAGE (banner at 57 s; −120 px per side from 60–75 s; verified 352–928) · METEOR SHOWER (red target + visible falling rock 1.2 s before impact; 8 dmg; step aside) · COIN RAIN (falling coins heal 5%) · GLITCH (a new random implemented modifier every 20 s, announced by banner).
- [x] **8 P1 recipes live** (`recipeTiers` default now P0+P1; P0 still win ties). Perks: LASER SHOW two beams in both parents' colours (verified) · GOLDEN BULL dash super armor (verified) · BEAR MARKET +5% damage while above 100% (verified 10.5 vs 10) · SKULL & BONES combo ender launches up · SHARK WEEK drool puddle bites · HONK LORD +0.2 s stun · DOUBLE RAINBOW longer puke · BTC MAXI +10% speed. TRY A SECRET MUTATION now covers all 16 (`src/config/secretPairs.json`). The 20-pair stability snapshot is unchanged.
- [x] **Share card:** DOWNLOAD PNG (1200×675; mutant art, name, both parents, genes, recipe/Unstable badge, W–L, wordmark, deep link) + POST ON X (intent link; never auto-posts) on reveal and results. Verified: a real pair exported a valid 1200×675 PNG in Chromium.
- [ ] Wallet + MY CHOGS (holder mode)
- [ ] Recorded Splice UI (needs `contracts/` registry from the Reviewer + Maris's mainnet deploy)
- Balance with P1 live (300 matches, seed 2026): the first run FAILED (PUKE 72% at n=50; LEECH 80%; healing genes ~80% because bot matches reach the 120 s timer). Tuned: PUKE 2→1.5 dmg/tick and cooldown 3→3.5 s; LEECH 8→7 dmg, heal 35→25%; REGEN/BLOOM heal 1% every 3 s (was 2 s). Re-run PASSES; highest with n ≥ 30 is FROST 59.3%. Small samples are still noisy (UNDEAD 89% at n=19; it was 63–68% in earlier runs). Weakest: SHIV 20% (n=10), DROOL 29%, TEARS 31%, FLOATY 32%.
- Bug fixed: a key tapped down and up within one frame was lost (Phaser clears JustDown on keyup). Presses are now queued from keydown, which also buffers inputs during hitstop.

## Game polish pass (Maris: "keep polishing the game: feel, visuals, bot")
Reviewed full-size screenshots of every screen (`SHOTS=1 npx playwright test tests/e2e/shots.spec.ts` → `test-results/shots/`).
- **Camera:** Smash-style dynamic camera frames both live fighters (zoom 1–1.35, eased, clamped so no void shows); zooms out on GAME!. The HUD moved to an overlay scene (`src/arena/HudScene.ts`) so it stays fixed; damage numbers punch when they rise; a lost life shows as a crossed-out pip.
- **Readability:** ground shadow (shrinks with height), player-colour ring under the feet, YOU/CPU/P1/P2 tag above each fighter.
- **Attack visuals:** punch arcs in the player's colour (gold on the combo finisher), headbutt arc, dash afterimages, a growing flickering glow while BEAM charges (replaced the hard-to-read "CHARGING" text).
- **Pre-match:** mode, difficulty and FIGHT ▸ moved into one bar under the mutant cards (they were below the fold at 900 px). The first match of a session flashes a compact controls card during the countdown.
- **Lethality (bot matches mostly timed out):** knockback unit 1.0 → 1.2 and hitstun air drag 520 → 420. Hard bot-vs-bot, 20 matches: lives lost per match 0.85 → 1.55 (×1.1) → **1.8** (×1.2), KO finishes 2/20 → 8/20, average match 118 s → 107 s. The early-kill guard is now physics-based: at 60% no move carries a normal-weight fighter from mid-stage to the blast zone (unit test).
- **Bot:** edge-guards with ranged specials (SPIT/BEAM/CHAOS ORB/TEARS) at an opponent recovering from off-stage.
- Refactor: fighter tuning constants moved to `src/arena/tuning.ts` (Phaser-free, unit-testable).
- **Bug fixed: fighters fell through the floor at low frame rates.** At about 20 fps (long frames ≈ 50 ms) a resting fighter sank further into the floor than Arcade's default overlap tolerance (4 px + the distance moved), so separation was skipped and both fighters dropped through and lost a life about 3 s in. Set `overlapBias: 20` (game + headless sim). Regression test: 10 s of idle fighters with the CPU throttled 20× (it fails with the old value and passes with the fix).
- Balance after polish + fix (300 matches): first run FAILED on BUBBLE 68.6% (n=51) → BUBBLE shield 1.2 → 1.0 s and cooldown 4 → 5.5 s; LEECH heal 25 → 15%, cooldown 4 → 5 s. Re-run PASSES (no gene with n ≥ 30 above 65%; the high rates left are small samples: TOXIC/SHIV n=10, UNDEAD n=19, LASER SHOW n=14).
- Full e2e: 29/29 pass (bot recovery 10/10, 60 fps).

## Feel pass 2 (Maris, after playing: "I don't even know how to play, and it looks like moving static pictures")
- **Animated fighters** (`src/arena/rig.ts`): the spliced mutant is cropped into a round portrait head on a code-drawn body tinted by both parents' skins, with a player-colour belt, legs and fists. Idle breathing, run cycle with leg and fist swing, jump tuck, landing squash, dash stretch, jab / cross / uppercut punches, guard pose, head wobble in hitstun, tumble spin on big launches, hit flash. Drawn 25% larger than the hitbox; physics unchanged. Headless sims skip the rig.
- **Learn while playing:**
  - Home: "1 Pick two Chogs · 2 Splice · 3 Fight" strip.
  - Pre-match: HOW TO WIN (3 lines) + a visual keyboard (move keys cyan, punch/dash white, gene keys yellow and labelled with this mutant's actual moves, e.g. L = BEAM, I = HEADBUTT). The old controls table was removed.
  - First fight: a step-by-step coach (`src/arena/coach.ts`): A/D → W double jump → J combo → L special → I close move → K dash → knock them off. Each step clears when done (or after 9 s); shows "HOW TO PLAY n/7".
  - Bot grace period: in the first coached fight the bot wanders and does not attack for 8 s.
- **Rule fix:** blast zones are now checked right after the physics step and before fighters act. Previously a bot past the line could BLINK back out on the same frame (found by the forced-KO e2e tests).

## Polish pass 3: sound, reveal, lab
- **Sound engine rewrite** (`src/audio/sfx.ts`, all synthesized): master bus → compressor (no clipping on big hits) + a code-generated reverb send; slight random pitch variation; layered sounds (punch = thump + snap, combo finisher heavier; big hit + crunch; KO = boom + falling shriek + rumble; chamber-door impact with metal ring; two-tone lab siren; electric crackle + mains buzz; new splice spin-up whine; bell arpeggio for secret mutations; victory and defeat stingers). All 16 sounds verified to play without errors in the browser (not audibly checked by the Builder; human ear needed).
- **Reveal:** a three-part splice rig. Parent A and B sit in glowing glass tubes either side of the chamber; jittering lightning arcs jump into the chamber during the spike; the parents drain out, the doors open with a white flash, the mutant pops in; then the tubes refill so A + B sit beside the result. The name glitches in, the recipe banner slams, gene rows stagger in. Reduced motion: no flash, no lightning, 1 s crossfade (e2e test).
- **Lab:** chambers are liquid glass tanks with rising bubbles; loaded Chogs float gently and the tank glows in its parent colour; SPLICE pulses once two Chogs are loaded; a hint says what to do when it isn't ready; grid tiles lift on hover and picked tiles glow.

## Background music (P-2, approved by Maris)
- `src/audio/music.ts`: lookahead-scheduled synth music, no audio files. **Lab loop** (88 bpm: soft pads Am7–Fmaj7–Dm7–Esus, slow arpeggio, light hats) on every screen except the arena; **arena loop** (128 bpm: four-on-the-floor kick, clap, syncopated bass, chord stabs, a lead every other bar) during fights. Tracks crossfade on screen change; music pauses when the tab is hidden and starts after the first click or key press (browser autoplay rules).
- **MUSIC ON/OFF** button next to SOUND, persisted (`chogbreak.music.v1`). SOUND OFF silences music too and disables the MUSIC button. Verified in the browser through the real buttons (track switch lab → arena, MUSIC OFF/ON, SOUND OFF/ON) + e2e test for persistence. Not audibly reviewed by the Builder.

## Polish pass 4: notebook, results, bot
- **Notebook v2 (closes a §D2 gap):** each card now shows the rendered mutant (lazy), both parents, a W–L bar, SECRET/UNSTABLE badges and **FIGHT ▸ / PNG / POST** buttons (the spec asks for Fight and Share on notebook cards). Filters ALL / SECRETS / UNSTABLE and sort NEWEST / MOST WINS. Unknown slots still never reveal the total.
- **Results v2:** both mutants' art, the winner glowing with a WINNER stamp (confetti on a win) and the loser greyed with K.O.; a lives scoreboard; stat tiles (KOs, damage-dealt bar, time, notebook record). A **LAB TIP** says when a parent is half of a secret recipe not yet found, without naming the recipe or the missing trait, to push "splice again".
- **Bot:** steps off arming/active hazards (toxic segments, meteor targets, fire, runes) and keeps running until clear; hops over incoming projectiles; anti-air jump + punch at an opponent above it. All gated by a new per-difficulty `awareness` (Easy 0.2, Normal 0.55, Hard 0.9).
- Balance after the smarter bot: PUKE rose to 72% (n=50) because bots walk into its cone more → PUKE 1.5 → 1.2 dmg/tick, cone 140 → 120 px, cooldown 3.5 → 4 s. Re-run (300 matches) PASSES.
- **Verified** (`tests/e2e/bot.spec.ts`): difficulty ladder, 30 headless matches each with real mutants: **Hard beat Easy 29–1, Normal beat Easy 29–1, Hard beat Normal 27–3**. The bot escaped an arming hazard in 4/4 trials (moved 117–351 px).

## Phase 7 prep (submission package)
- **Load time:** the browser now loads a slim manifest (`public/data/chogs.min.json`, no tokenUri/image; written by `build-manifest`) in parallel with sprite info, preloaded from the HTML. e2e on a simulated 10 Mbit/s / 40 ms cold load: Lab interactive with first thumbnails in **2.0–2.3 s** (spec < 3 s) (`tests/e2e/perf.spec.ts`). Before: 1.9–3.4 s.
- **Honesty and placeholder audit (§G3):** no "coming soon", TODOs, lorem, fake data or overclaims in visible UI. Removed "NFTs" jargon from the home strip. `npm run docs:check` checks the description length and flags forbidden claims (secure randomness, burns, online multiplayer, decentralization, copyright/royalties) in README and SUBMISSION. It currently flags nothing.
- **README** rewritten for judges: pitch, 60-second no-wallet quick start with deep links (incl. a recipe), why the NFTs are essential (each point mapped to code), what is and isn't in this build (no wallet, registry or payouts, stated plainly), run/test, architecture, determinism, data provenance, security, limitations, licenses.
- **docs/SUBMISSION.md:** text for every field; description 2,996 / 8,000 chars. `<APP_URL>` to fill after the deploy.
- **docs/DEMO_SCRIPT.md:** ≤ 3:00 shot list matching this build (no wallet or on-chain segment).
- **All 16 recipe perks now tested** (added SKULL & BONES 38° → 80°, SHARK WEEK bite zone, HONK LORD stun +0.2 s, DOUBLE RAINBOW reach, BTC MAXI +10% speed).
- **Fresh clone → `npm ci` → `npm run build`: succeeds** (built in 30 s). npm 11 warns that esbuild/sharp install scripts were not run; the build works regardless.

## Wallet connect + MY CHOGS (Maris, 2026-10-19: "build wallet connect and MY CHOGS holder mode")
- `src/chain/client.ts`: injected EIP-1193 wallet via viem; `wallet_switchEthereumChain` to 143, falling back to `wallet_addEthereumChain` (Monad, MON/18, RPC from `chain.ts`; no explorer URL because the explorer is still unverified).
- `src/chain/ownership.ts`: `balanceOf(owner)` first (0 → no scan), then `ownerOf` for IDs 1–1969 via Multicall3 in chunks of 250, stopping as soon as `balance` tokens are found; failed calls ignored; result cached per address for the session.
- `src/state/wallet.ts` + `src/ui/MyChogs.tsx`: connect panel, scan progress, error/RETRY, empty state, owned cards (genes, experiments from the notebook, secrets found, count of undiscovered recipes it is half of), SPLICE WITH… loads it into chamber A. Topbar wallet chip + SWITCH TO MONAD; Lab gets ALL CHOGS / MY CHOGS tabs; `?view=mychogs` deep link.
- Never signs or sends anything; guest features never wait on the wallet. Friendly errors for no wallet, rejected request, timeout, network failure.
- Tests: `tests/unit/ownership.test.ts` (balance 0 skips the scan, chunking + early stop, case-insensitive, failures ignored); `tests/e2e/wallet.spec.ts` with a mock EIP-1193 wallet whose address is the **real** current owner of token 1 (looked up on Monad at test time): finds CHOG #1462 on-chain, wrong network → SWITCH TO MONAD adds the chain, SPLICE WITH…, Lab MY CHOGS tab; no wallet installed; rejected request.
- Full regression: 64 unit + 37 e2e pass (balance sim passed on rerun). Found and fixed a date-dependent test flake: the default opponent is seeded by the UTC date and today's has a SHIELD element, halving the first hit in two gene tests; the gene e2e helpers now neutralise the opponent's element.
- HUMAN CHECKPOINT: Maris to try it with her real wallet.

## Lab search fix (Maris, 2026-10-19: "the lab keeps bringing one result")
- Search only matched exact numbers or the name (every name is "CHOG #N"), so "14" gave ≤ 2 results and "crown" or "laser" gave 0. Now: exact number first, then IDs/numbers starting with the digits typed ("14" → 221), and text matches any trait value ("crown" → 54). Placeholder now says "Number or trait (crown, laser…)". Unit tests added.

## Lab picking fix (Maris, 2026-10-19: "picking not working")
- Clicking a Chog only opened its detail panel; loading needed LOAD INTO A/B further down, easy to miss. Now one click fills the next empty chamber (A, then B); when both are full, a click shows details with LOAD INTO A/B. Hints say "Click a Chog below". e2e test added.

## Audit (2026-10-19)
- Full requirements audit in `docs/AUDIT.md`. Fixed: CHAOS ORB balance (72% → 59%), reveal layout on phones, demo script wallet segment, README holder path.

## 2.5D arena (Maris approved, 2026-10-19)
- `src/arena/three/Stage3D.ts`: three.js scene (lab wall, columns, girder with beacons, glass tanks on a grid floor, 3D main stage with hazard-stripe top and glowing edges, floating platforms on hanger rods, key/fill/rim lights, hit-flash point lights, blob shadows). Rendered on Phaser's POST_RENDER with the Phaser camera's centre, zoom and shake, so the 3D platform tops sit exactly on the physics bodies. Phaser canvas is transparent; its platform rectangles stay as invisible physics bodies.
- Fallbacks: `?arena=2d`, no WebGL, or a failed import → the 2D arena; headless sims never create it.
- e2e: the 3D canvas lines up with the Phaser canvas (±1.5 px), no console errors, `?arena=2d` has no 3D canvas.
- Balance sim is now deterministic (see DECISIONS); it passes for seed 2026 every run.
- **3D fighters** (`src/arena/three/Fighter3D.ts`): same `Rig` interface and pose math as the 2D rig; lit body, legs, floating fists and belt with inverted-hull outlines; the portrait on an unlit, non-tone-mapped disc on a coin head (NFT colours stay true); three-quarter yaw, mirrored when facing left like the 2D rig. Physics and hitboxes unchanged; headless sims don't use it.

## Holder perks + Recorded Splice (Maris, 2026-10-20: options 1 and 2; Builder assigned the contract)
- **Holder perks (cosmetic):** YOURS tag in the Lab grid, HOLDER SPLICE on the reveal, YOUR CHOG badge in the notebook, holder line on share cards. Ownership is read from Monad; never affects gameplay. e2e in `wallet.spec`.
- **Contract:** `contracts/src/ChogBreakRegistry.sol` exactly per §D10 (Ownable2Step, ReentrancyGuard, Pausable, SafeERC20; no upgradeability, delegatecall, selfdestruct or rescue). OpenZeppelin 5.6.1 from npm (the git clone kept failing); forge-std as a submodule.
- **Foundry:** 29 tests, all of the §D10 list (incl. TS/Solidity pairKey vectors from the shared fixture, odd-fee fuzz, reentrancy via malicious token, owner spoofing, pause, admin, events) + fee-raise-after-approval. 5 fork tests vs Monad mainnet pass (ownerOf(1), decimals 18, exact $CHOG transfer, full recordSplice against the real Chog Genesis + $CHOG). `forge coverage` could not run: Foundry 1.8.3's analyser rejects the standard `Ownable(owner)` constructor call through Ownable2Step (tool bug); every function and branch has a test.
- **Deploy:** `contracts/script/Deploy.s.sol` prints everything (chain id, deployer + MON balance, addresses, decimals read on-chain, fee/max raw + human, prize, owner, split) and aborts unless `CONFIRM_MAINNET_DEPLOY=YES` and chain 143. Dry run against Monad checked. `docs/DEPLOY.md` walks Maris through keystore → dry run → deploy → hand back address + tx.
- **App:** `src/chain/registry.ts` (check chain → fee/balance/allowance → approve exactly the fee → simulate → wallet → receipt success → decode events; §D9 error copy), `RecordedSplice.tsx` (RECORDED SPLICE next to the free SPLICE, confirm panel with the 35/35/20/10 split and both owners, progress), FIRST DISCOVERY! banner, on-chain pair line on the reveal, ON-CHAIN notebook badge (recordedTx), MY CHOGS uses + $CHOG earned. Hidden while `REGISTRY_ADDRESS` is null.
- **Tests:** `tests/unit/registry.anvil.test.ts` (6, real compiled contract on anvil chain 143: ABI parity, exact approval, payouts, discovery, stats, errors); `tests/e2e/recorded.spec.ts` (3, real browser → real contract on anvil: full flow, repeat recording, hidden without registry).
- **DEPLOYED 2026-10-20** by Maris from the VPS (`/opt/chog-break-contracts`, deployer `0x17f2079259f18F9384DF6056b8E4185247db13FC`): registry `0xB435a54816Cb32B70F08C34fF388B9A718Ba3Db1`, tx `0xd2fae7a1dea094d2512c7b4e0293b94e50c7774c8bbd0df052f4c15f05743588`, block 115149552, 0.139 MON gas. Fee 100 $CHOG, MAX_FEE 10,000 $CHOG; owner and prize recipient = the deployer (can be moved later: two-step ownership, setPrizeRecipient). `npm run registry:verify` passes (runtime code identical; only the path-dependent metadata hash differs from a local build). Source verified on Sourcify/MonadVision: exact match. `REGISTRY_ADDRESS` set; Recorded Splice is live in the app.
- **HUMAN CHECKPOINT (open):** one real Recorded Splice on mainnet; paste the Monadscan links here and check both owners got 35%.

## Landing page + sponsored (gasless) recordings (Maris, 2026-10-21)
- **Landing page** at `/` (separate light page: ~50 KB gzip JS, no game engine or game data); the game is its own page at `/play/` (`play/index.html`); old `/?a=…` links redirect there before loading. Lab interactive now 1.4 s on the 10 Mbit/s profile. e2e `landing.spec`.
- **Registry v2** (`recordSpliceFor`: payer pays, player credited; `payer` in `SpliceRecorded`): 34 Foundry + 6 fork tests. On the VPS in `/opt/chog-break-contracts-v2`, **waiting for Maris to deploy** (fee 10 $CHOG).
- **Sponsor** (`sponsor/`): one free recording per wallet and per IP every 48 h, daily cap (30), signed claim, exact approval, serialized relays; systemd unit (DynamicUser, read-only system). 6 anvil tests + 2 browser e2e against the real server.
- **v2 DEPLOYED 2026-10-21** by Maris: `0x0EBe620530E604E6D05E0ffE7589c807E9e91527`, tx `0x41642ca43c6b63be4f0d3d97e84cf2b1c4274a61ec971e6fc6cfa14f55869f0d`, block 115344795, fee 10 $CHOG. `registry:verify` passes; Sourcify exact match. App switched to v2.
- **Sponsor LIVE** on the VPS: `/opt/chogbreak-sponsor`, systemd `chogbreak-sponsor` (DynamicUser, sandboxed), Caddy site `https://chogbreak-api.38-49-209-149.sslip.io` (Caddyfile backed up first; `caddy validate` passed; other sites checked 200). Relayer `0xBA8a991eC2cA798055f6BDF53895aB3F84616f63` (key only in root-only `/etc/chogbreak-sponsor/relayer.env`). DAILY_CAP 30. RECORD FREE appears only while the relayer is funded.
- **Relayer funded 2026-10-21:** 1 MON + 500 $CHOG (= 50 free recordings at fee 10). Sponsor status `eligible: true, funded: true`; the live landing page shows the free-recording line.
- **First real Recorded Splice on mainnet (2026-10-21, done by the Builder at Maris's request):** a free (sponsored) recording of pair #101 × #202 for a throwaway in-memory wallet `0x0D2E68Fb05cba05BFd637414b7BD275f0c3816DA` (key never shown or saved). Tx [0xfa06348c…c874](https://monadscan.com/tx/0xfa06348c2cc0b589c68dd7c1e9d7e21aa34b562cfc3a852b53abb7be0b9ac874) (approve [0x8028e882…a19d](https://monadscan.com/tx/0x8028e882098f0e5520d66b646075105b391470550c17a8eb955a97854293a19d)), block 115372075, status success; `first = true`, `firstDiscoverer` = the player, `payer` = relayer. Transfers in the receipt: 3.5 $CHOG to ownerOf(101) `0x335f…e25F`, 3.5 to ownerOf(202) `0xDC4F…930F` (both match on-chain ownerOf), 2 to the prize address, 1 to the dead address; relayer paid exactly 10. §F Phase 6 human checkpoint met.
- **v1 paused 2026-10-21** by Maris: tx [0x955913d7…35ad](https://monadscan.com/tx/0x955913d70475c703b03b30897c65ed0092b4a916de02fb4c790cdbb2106135ad), block 115372529; `paused()` = true on v1, v2 unaffected.
- **Repo public 2026-10-21:** https://github.com/Stella112/chog-break (re-scanned first: no keys in files or history; the only 64-hex values are public tx hashes).
- **Open (Maris):** demo video, submit.

## Broken
- Nothing known. Note: a full e2e run during which the PC slept took 3.3 h and timed out 2 tests; both pass when rerun.

## Blockers
- HUMAN CHECKPOINT: Vercel production deploy (Maris).

## What Maris must do (deploy)
1. ~~Push the repo to GitHub~~: done 2026-10-20, **private** repo https://github.com/Stella112/chog-break (make it public before submitting: judges need the link).
2. Vercel → Add New → Project → import the repo → Deploy (settings come from `vercel.json`; no env vars needed).
3. Open the live URL: home → ENTER THE LAB → splice two Chogs → FIGHT.
4. Paste the production URL to the Builder. The Builder then makes the og:image URL absolute and runs the §G1 checklist against the live site.

## Next
- Maris tests MY CHOGS with her real wallet.
- Maris deploys the registry (docs/DEPLOY.md) → Builder sets REGISTRY_ADDRESS and verifies it on-chain → one real Recorded Splice.
- Recorded Splice if the registry exists.
- Last: Vercel deploy → §G1 on the live URL → P0 DONE.


## Unverified facts (all in `src/config/chain.ts`)
- ~~RPC URL~~: **verified 2026-10-20** in the official Monad docs (network information page).
- Multicall3 has code at the canonical address and multicall calls succeed (functionally verified).
- IPFS gateways are third-party: filebase works; pinata, ipfs.io and dweb.link return 429 under load.
- `eth_getLogs` works for a 100-block range and fails at 1,000.
- ~~Block explorer + verification~~: **verified 2026-10-20**: Monadscan (`/address/`, `/tx/` checked against live data) and MonadVision are the official explorers; contract verification via Sourcify (`--verifier sourcify --verifier-url https://sourcify-api-monad.blockvision.org/`, no API key) or Monadscan (API key). Now in `src/config/chain.ts` and `docs/DEPLOY.md`.

## Needs human verification
- $CHOG `burn()`: the implementation bytecode contains the selectors, but the source was not checked. The spec still uses the dead address.
- ~~$CHOG fee-on-transfer~~: **resolved 2026-10-20** by `contracts/test/Fork.t.sol` against Monad mainnet: a transfer delivers exactly the amount sent; decimals 18.

## Demo video (Maris, 2026-10-21: "very good demo video with good motion graphics and voice over… 3mins max")
- `video/out/chog-break-demo.mp4` (2:08, 1080p30, -14 LUFS) and `chog-break-demo-web.mp4` (55 MB). Not committed (gitignored); pipeline in `video/README.md`.
- All footage is the real production build: frame-stepped captures (virtual time for UI, `game.step` for the arena), the game's own SFX recorded sample-exact via an OfflineAudioContext, the game's own music rendered offline (`renderTrackOffline` in `src/audio/music.ts`).
- Voice: Microsoft neural voice (edge-tts, en-US-AndrewMultilingualNeural), sentence by sentence with hand-set pauses; graphics timed to word boundaries.
- On-chain section uses the real first mainnet recording's receipt (read from RPC): 3.5 / 3.5 / 2 / 1 $CHOG. Its pair's art (#1562 wears a "RETARD Cap") is not shown, only IDs. Monadscan is behind a Cloudflare check, so no explorer screen capture.
- Chogs whose art prints crude words are excluded from the walls; the swap clip starts after the unfiltered grid.

## XP and wins (Maris, 2026-10-22: "there should be xp added and number of wins")
- `src/state/progress.ts`: every lab-bot match gives XP (win 100, draw 50, loss 30, +15 per KO) to the mutant (notebook entry `xp`) and to both parent Chogs (`chogbreak.progress.v1`: xp, wins, losses, fights per token ID). Levels at 100 / 300 / 600 / 1000… XP. Cosmetic only: no stat effects, fights stay deterministic. Local 2P earns nothing.
- Shown on results (mutant + both Chogs, +XP and LEVEL UP), notebook cards, the Lab's Chog detail panel and MY CHOGS. Stored in this browser only (not on-chain).
- Tests: unit (formula, levels, crediting) and e2e (two wins → 2 WINS on both Chogs, LV 2 in the notebook).

## Proposals
- ~~P-2, background music~~: **approved by Maris (2026-10-18) and built**; see below.
- ~~P-1, mutant art matches the genes~~: **approved by Maris (2026-10-19) and built** as core v2: the parent that gave the inherited Head is the top half of the art (falls back to the visual stream when neither parent has a Head). `CORE_VERSION` 1 → 2; `createMutant({ version: 1 })` still reproduces v1 exactly (unit test: v1 and v2 differ only in `visualRecipe.topParent`). Checked on KING BEAM: the crown parent is on top and the laser beam from the other parent still shows below the seam.

## Do not touch
- `contracts/**`, `docs/REVIEW.md`, `docs/SECURITY.md`, `tests/review/**` (Reviewer-owned)
- `../chog-hearth/` (an unrelated project)
