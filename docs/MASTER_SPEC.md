# CHOG//BREAK: MUTANT ARENA — MASTER SPEC v2
### Build specification + agent operating contract (single source of truth)

> **Setup (Maris does this once):**
> 1. Create the repo. Put this file at `docs/MASTER_SPEC.md`.
> 2. Create `CLAUDE.md` at the root: *"You are the BUILDER defined in docs/MASTER_SPEC.md §A. Read the whole spec, PROGRESS.md and docs/HANDOFF.md before any edit. Obey the spec over your own ideas."*
> 3. Create `AGENTS.md` at the root: *"You are the REVIEWER defined in docs/MASTER_SPEC.md §A. Read the whole spec, PROGRESS.md, docs/REVIEW.md and docs/HANDOFF.md before any edit. Obey the spec over your own ideas."*
> 4. Start the Builder (Claude Code) with: *"Read docs/MASTER_SPEC.md fully, then start Phase 0."*
> 5. Start the Reviewer (Codex) with: *"Read docs/MASTER_SPEC.md fully, then start Review Track R1."*
> (The roles are tied to the files, not the tools. If you want Codex to build and Claude to review, swap the two files.)

---

## §0. THE PRODUCT IN ONE BREATH

**Pick any two real Chog Genesis NFTs. Splice their real traits and artwork into a deterministic mutant. Fight it in a short side-view arena whose rules are also mutated by the Chogs in the match.**

- Core loop: **SPLICE → REVEAL → FIGHT → DISCOVER → SPLICE AGAIN**
- Public hook: **Pick two Chogs. Splice them. See what goes wrong. Then fight it.**
- Positioning: **The Chog NFTs are not skins. They are genetic material.**
- Success test: after one viewing, a judge can say *"You combine two real Chog NFTs, they make a weird fighter from their traits, and you fight with it."* If they say *"some NFT dashboard/game thing"*, we failed.

The project wins or loses on **three moments**: **THE SPLICE** (exciting), **THE REVEAL** (you instantly see how A + B made this), **THE FIGHT** (fun enough that people press rematch). Everything else is secondary.

---

## §A. ROLES, MANDATE AND RULES

### A1. People and agents

| Who | Role | Owns |
|---|---|---|
| **Maris** | Product owner. Final say on scope. Holds all keys and funds. Deploys contracts, signs every transaction, connects Vercel/GitHub, records the demo video, submits. | Decisions, wallets, deployment, submission |
| **BUILDER** (default: Claude Code) | Lead engineer for the whole app | Everything **except** `contracts/**`, `docs/REVIEW.md`, `docs/SECURITY.md`, `tests/review/**` |
| **REVIEWER** (default: Codex) | Independent verifier + contract author | `contracts/**`, `docs/REVIEW.md`, `docs/SECURITY.md`, `tests/review/**` (extra tests). Reads everything; **never edits `src/**`** — files findings instead |

Why this split: one agent owns the app so there are no merge fights; the second agent owns the only isolated part (the contract) and double-checks the parts that must be exactly right (data, determinism, security).

### A2. The mandate (non-negotiable, both agents)

1. **This spec is the single source of truth.** Build what is written. If it isn't in the spec, it's out of scope (§A6) until Maris adds it. Do not redesign the product or substitute your own idea.
2. **Never invent anything external:** no invented contract addresses, ABIs, methods, RPC URLs, chain facts, token decimals, burn functions, endpoints, library functions, hackathon rules, trait categories or trait values. Every external fact comes from (a) §C1 VERIFIED, (b) a check you actually ran and logged, or (c) official docs you actually read.
3. **Unverified facts live in one place:** `src/config/chain.ts` (or `contracts/script/config`) with a `// UNVERIFIED:` comment, listed in `PROGRESS.md → Unverified`. Never scatter guesses through code.
4. **Never claim it works unless you ran it.** Report *files changed, commands run, test result, build result, known issues*. If you couldn't run it, write exactly: **"Implemented but not runtime-verified"** plus the steps Maris should take.
5. **No fake data, ever, in production paths.** No fake owners, earnings, leaderboards, transaction hashes, usernames, activity or metadata. Empty states are fine; fake activity is not. Fixtures live only in test files, clearly named `*.fixture.*`.
6. **Check library APIs before using them:** confirm the installed version and read its type definitions in `node_modules`. Check contract ABIs before calling methods.
7. **Rarity never equals strength.** Enforced by test (§D4.9).
8. **Secrets never enter the repo, logs or chat.** `.env*` git-ignored; commit only `.env.example` with empty values. Never ask for a private key or seed phrase.
9. **No silent scope changes.** Disagreements go in `PROGRESS.md → Proposals` (Builder) or `docs/REVIEW.md` (Reviewer); keep building the spec.
10. **Respect IP and licenses.** Use only: real Chog Genesis art from the collection's own metadata, original UI art made in code (CSS/SVG/canvas), Google Fonts, and sound synthesized in code (WebAudio). No third-party characters, logos, music, sound packs, or images. Do not copy code from other Chogathon entries.
11. **Never claim:** that something is on-chain when it isn't, that randomness is secure, that tokens were burned unless they verifiably were, or that NFT ownership grants copyright/royalties.
12. **Never silently swallow an important failure.** Show a recoverable error state.

### A3. How the Builder works

- Read the whole spec first. Write the plan for the current phase in `PROGRESS.md`.
- Small steps. After each step: `npm run typecheck && npm run lint && npm test`. Fix failures before moving on. Commit small, outcome-named commits (`feat(core): deterministic splice engine`, `fix(arena): lives decrement exactly once`).
- `PROGRESS.md` sections: **Last updated · Current phase · Working · Broken · Blockers · Next · Unverified facts · Needs human verification · Proposals · Do not touch**. Anyone must be able to pick up from it cold.
- End of every phase: run its acceptance checklist (§F), paste results into `PROGRESS.md`, then continue unless a STOP condition applies or the phase says **HUMAN CHECKPOINT**.
- Debugging order: reproduce → isolate → read the actual error → check the installed API/version → add a regression test → smallest correct fix → rerun tests → rerun build → note significant decisions in `docs/DECISIONS.md`. If the same error survives two fixes, change approach; if a third approach fails, STOP.
- Never rewrite working subsystems wholesale. Never delete code you don't recognise.

### A4. How the Reviewer works

- Works through Review Tracks R1–R4 (§F-Review) in parallel with the Builder.
- Findings go in `docs/REVIEW.md` as numbered items: **ID · severity (BLOCKER / HIGH / MEDIUM / LOW) · file:line · what's wrong · evidence (command + output) · suggested fix**. Never vague ("could be improved").
- A finding is only BLOCKER/HIGH if you reproduced it. Unreproduced suspicions are LOW with "unconfirmed".
- To request a change in Builder-owned code, add an entry to `docs/HANDOFF.md` (`REVIEWER → BUILDER: …`). The Builder replies in the same file when done.
- The Reviewer may add tests under `tests/review/**`. If they fail, that is a finding, not something to "fix" in `src/`.

### A5. STOP conditions (both agents) — stop, write the question in PROGRESS.md / REVIEW.md, ask Maris

1. Adding any feature, screen, mode or dependency not in this spec.
2. Removing or downgrading any P0 feature.
3. Changing the tech stack (§B).
4. Using any external fact you could not verify.
5. Anything that moves real funds: deploying, changing fees or the split, approving tokens on mainnet.
6. Real data contradicts this spec (missing trait values, token IDs not 1–1969, $CHOG behaves non-standardly, e.g. fee-on-transfer).
7. Same problem unsolved after three different approaches.
8. A phase looks likely to overrun its time box by more than half a day.

### A6. OUT OF SCOPE (hackathon version)

3D, 3D models or ragdolls · online real-time multiplayer/netcode before bot mode is done (and only as P2) · minting mutants as NFTs · breeding that creates tokens · new tokens, staking, yield, DeFi, governance, wagering/betting on fights · any AI/LLM feature or API · accounts/sign-up · NFT marketplace · open world, story campaign, crafting, inventories, skill trees, clans, season pass · token price widgets / trading terminals · voice chat · upgradeable/proxy contracts · admin dashboards beyond contract owner functions · mobile-native apps.

### A7. Priority tiers (never work on a lower tier while a higher tier is broken)

- **P0 — MUST SHIP:** Guest Lab (browse/filter/search real Chogs, splice, reveal, notebook), deterministic core, mutant art from both parents, Vs Bot (Easy/Normal/Hard, Normal default), base combat, all gene effects (§D4), 4 arena modifiers, 8 secret recipes, "TRY A SECRET MUTATION" button, deep links, audio + mute, reduced motion, error states, production deploy.
- **P1 — after P0 is green:** wallet connect + holder mode (MY CHOGS), Recorded Splice (contract + UI), share card export, local 2-player, remaining 8 recipes, remaining arena modifiers.
- **P2 — only if P0+P1 are green before the feature freeze:** Daily Experiment, Daily Chaos, Discoveries feed, holder earnings page, gamepad, challenge links, fight leaderboard.

**Bug priority:** 1 crash · 2 lost/corrupted state · 3 broken core loop · 4 bad controls · 5 balance · 6 broken chain verification · 7 visual bugs · 8 secondary features · 9 cosmetic perfection.

---

## §B. TECH STACK (fixed) AND LAYOUT

| Area | Choice | Notes |
|---|---|---|
| Build | **Vite + TypeScript (strict)** | Single app (no monorepo). Node ≥ 20, npm |
| UI | **React 18** | Screens, browser, notebook |
| Arena | **Phaser 3** (Arcade Physics) | One instance, destroyed on unmount. Phaser owns frames; React owns surrounding state. No React re-render per physics tick |
| Chain (browser) | **viem** only | Injected wallet (`window.ethereum`) via `createWalletClient({ transport: custom(...) })`. No wagmi, no WalletConnect |
| Contracts | **Solidity ^0.8.24, Foundry, OpenZeppelin v5** | Reviewer-owned |
| Tests | **Vitest** (unit), **Playwright** (critical guest flow), **forge test** | |
| Lint/format | ESLint + Prettier; `forge fmt` | |
| Hosting | **Vercel** static build | |
| Sound | WebAudio, synthesized in code | No audio files → no licensing risk |
| Image processing (build-time scripts only) | `sharp` | |

Pin exact versions after checking `npm view <pkg> version`. Minimal dependencies: before adding one, confirm it's maintained, browser-compatible, builds on Vercel, and materially reduces risk; otherwise STOP condition 1.

```
/
├─ docs/  MASTER_SPEC.md · DECISIONS.md · HANDOFF.md · REVIEW.md · SECURITY.md · TRAIT_REPORT.md
│         RECIPE_EXAMPLES.md · DEPLOY.md · SUBMISSION.md · DEMO_SCRIPT.md
├─ CLAUDE.md · AGENTS.md · PROGRESS.md · README.md · .env.example
├─ scripts/  verify-chain.ts · build-manifest.ts · build-sprites.ts · trait-report.ts
├─ public/   data/chogs.json · chogs/{tokenId}.webp (256px, transparent) · chogs/thumbs/{tokenId}.webp (96px)
├─ src/
│  ├─ core/      ← PURE TypeScript. No React, Phaser, DOM, fetch, Math.random, Date.now.
│  │   types.ts · normalize.ts · pair.ts · rng.ts · genes.ts · splice.ts · recipes.ts
│  │   naming.ts · unstable.ts · arenaRules.ts · budget.ts · daily.ts
│  ├─ config/    chain.ts · game.ts
│  ├─ data/      manifest loader + indexes for filters
│  ├─ art/       mutantRenderer.ts · shareCard.ts · fallbackSprite.ts
│  ├─ arena/     Phaser scenes · fighter · moves/ · modifiers/ · bot.ts · input.ts · hud.ts
│  ├─ chain/     client.ts · ownership.ts · registry.ts · errors.ts
│  ├─ state/     notebook.ts (localStorage)
│  ├─ ui/        screens + components
│  └─ audio/     sfx.ts
├─ tests/  unit/ · e2e/ · review/   (shared fixtures: tests/fixtures/pairkey-vectors.json)
└─ contracts/  (Foundry) src/ChogBreakRegistry.sol · test/ · script/Deploy.s.sol
```

A lint rule or test must fail if anything in `src/core/**` imports React, Phaser, DOM APIs, or uses `Math.random`/`Date.now`.

---

## §C. FACTS

### C1. VERIFIED (re-check in Phase 0 anyway)

| Fact | Value |
|---|---|
| Hackathon | Chogathon 2026 — `https://chogathon.chog.xyz/` |
| Deadline | **Thu 23 Oct 2026, 15:00 UTC** (our internal target: submitted by 12:00 UTC) |
| Judging | Gate: NFT must be essential (pass/fail). Then Novelty 30 · Fun 20 · Retention 20 · Clarity 15 · Execution 15 · $CHOG bonus. Tie-breakers: novelty, then retention |
| Judges review | Description (≤ 8,000 chars), demo video (≤ 3 min, YouTube unlisted or Drive), app link, repo, judge access instructions, optional go-to-market |
| Chain | Monad mainnet, **chain ID 143**, native token MON |
| Collection | **Chog Genesis**, ERC-721, **1,969** tokens, `0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763` |
| Token IDs | Expected **1–1969** (multiple public sources). **NOT enumerable** (no `tokenOfOwnerByIndex`). Phase 0 must still **prove** the minted set (§E step 2) and record it in `public/data/valid-token-ids.json`; code uses that verified list, never a hard-coded range, until proven |
| **ID rule** | The visible name number ("CHOG #1462") is **NOT** the token ID (token 1 is named "CHOG #1462"). `tokenId` is authoritative for `ownerOf`, `tokenURI`, pair keys, contract calls, holdings. Display name is for humans only. Never call `ownerOf(nameNumber)` |
| $CHOG | ERC-20 `0x350035555E10d9AfAF1566AaebfCeD5BA6C27777` |
| Art | On IPFS; URL from each token's metadata `image` field |

### C2. UNVERIFIED — verify in Phase 0 (`scripts/verify-chain.ts` prints PASS/FAIL per row)

| Fact | Working assumption | Check |
|---|---|---|
| Public RPC | `https://rpc.monad.xyz` (confirm in official Monad docs) | `eth_chainId` = `0x8f` |
| Both contracts deployed | — | `eth_getCode` non-empty for NFT and $CHOG |
| NFT interface | `ownerOf`, `tokenURI`, `balanceOf` exist | call each on token 1 |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` | `eth_getCode` non-empty |
| $CHOG `symbol`, `decimals` | decimals probably 18 | call them. Never assume decimals |
| $CHOG has a `burn()` | **assume NO** | check verified source/ABI on the explorer; do not invent one |
| $CHOG fee-on-transfer / rebasing | assume standard | Reviewer fork test: transfer X, receiver balance increases by exactly X |
| Metadata format | JSON with `name`, `image`, `attributes[{trait_type,value}]` | fetch `tokenURI(1)` |
| Image URI pattern | `ipfs://bafybeihau2egcccbdxymeckmmbrqytbfor5gkt3en6d5fsbueymdbq7g6e/{nameNumber}.webp` | from metadata |
| IPFS gateways that work | try `gateway.pinata.cloud`, `ipfs.io`, `dweb.link` | fetch one image each |
| `eth_getLogs` max block range | unknown | find a working range; store in config |
| Explorer + verification method | unknown | official Monad docs |

### C3. REAL TRAIT DATA (from the collection's metadata; the Phase 0 generated manifest is the final authority)

**Critical facts about the data:**
- A token may simply **lack** a trait category. Absent ≠ a value called "None". Normalize absent to the internal value `none`.
- The 10 tokens with Base **"1:1"** have only Base and Tier (all other categories absent).
- Values are **case-inconsistent** ("Purple laser", "fire laser"). Normalize with `value.trim().toLowerCase()`.
- **Aura** is a real category on 974 tokens.
- Some values are crude/offensive. Show raw trait values only in the collection browser and trait lists. Arena, reveal headlines and share cards show **gene/move names**, not raw values.

- **Background** — 32 values · on 1959 tokens · ABSENT on 10: Light Purple (183) · Lemon (142) · Aqua (133) · Mon (131) · Sunlight (130) · Lemon Yellow (129) · Rosie (127) · Coral Pink (121) · Mint (114) · Peach Pink (95) · Light Magenta (92) · Soft Lavender (86) · Sky Blue (85) · Fresh Green (85) · Aqua Mint (69) · Rosy Pink (47) · Deep Aqua (46) · Lime Green (46) · Deep Blue (45) · Radioactive (30) · Red Sky (3) · Deep Purple (3) · Gold (3) · Magenta (3) · Royal Blue (2) · Bright Yellow (2) · Supreme Purple (2) · Noble Blue (1) · Afternoon Orange (1) · Blood Red (1) · Aqua Blue (1) · Rose Pink (1)
- **Base** — 4 values · on 1969 tokens · ABSENT on 0: Origin (1869) · Skull (60) · Radioactive (30) · 1:1 (10)
- **Skin** — 14 values · on 1959 tokens · ABSENT on 10: Pink (557) · Origin (528) · Red (299) · Black (263) · Yellow (246) · Blue (13) · White (11) · Green (8) · Jade (7) · Purple (7) · Multi Colored (7) · Beige (6) · Metal (4) · Grey (3)
- **Side** — 2 values · on 1959 tokens · ABSENT on 10: Right (1309) · Left (650)
- **Body** — 96 values · on 1762 tokens · ABSENT on 207: Tuxedo (55) · Kings Robe (41) · Gangster suit (41) · Black Trackset (40) · Farmer Shirt (39) · Squid Game Guard (37) · Black Vest (36) · Inmate (35) · Red Tuxedo (34) · White tuxedo (34) · Stripes (33) · Prisoner (33) · Six Seven (33) · Cream Tuxedo (31) · Black Shirt (31) · Fire Shirt (31) · Hawaiian Polo (30) · Chug Life (30) · Blue Chinese (29) · Duck Float (29) · Tank Top (29) · White Pure Shirt (28) · CWO (27) · Yellow Yukata (27) · Yellow Shirt (26) · Pink Tuxedo (26) · Red Chinese (25) · Shark Suit (25) · Banana suit (25) · Wizard (24) · Aqua Tuxedo (24) · Jesus (24) · Astro Suit (24) · Dragon suit (23) · Red shirt (23) · Blue tuxedo (22) · MILF Lover (22) · Red Trackset (21) · Orange Hoodie (18) · Squid Game (18) · Cyan tuxedo (18) · Mon Hoodie (17) · Orange Sleeveless (17) · Golden Armor (17) · Red Sleeveless (17) · Yellow Hoodie (17) · Yellow 143 Jersey (16) · White Sleeveless (16) · Brown Homeless Shirt (16) · toad blue suit (16) · pink vest (16) · dark jacket (15) · Sci Fi (15) · Blue 143 Jersey (15) · Red jacket (14) · Virgin (14) · Electro Hoodie (14) · red tee (13) · Grey Shirt (13) · Purple Shirt (13) · Grey Homeless Shirt (13) · White Shirt (13) · Blue jacket (13) · blue tee (13) · Glitch Hoodie (12) · dark tee (12) · White Yukata (11) · Army Vest (11) · Zero THOTS (11) · Blue Sleeveless (11) · white tee (11) · dark vest (10) · purple vest (10) · Blue Homeless Shirt (10) · Sky Hoodie (10) · Guko (9) · Toad pink suit (9) · BBC (9) · Red 143 Jersey (9) · Pink Shirt (9) · Toad green Suit (9) · Peach Hoodie (8) · Cyan Shirt (6) · Wizard Cape (5) · Gojo (4) · Stripe Shirt (4) · CEO Vest (3) · Mummy (3) · Stripe shirts (3) · Boner (2) · Jesus Robe (2) · Blue Holed Jacket (1) · White Tank (1) · Purple Tank (1) · Orange Holed Jacket (1) · Blue Mafia (1)
- **Mouth** — 15 values · on 1804 tokens · ABSENT on 165: normal smile (195) · Sad (184) · Drooling (184) · Smile (179) · Bubblegum (168) · Rainbow Puke (145) · Gold Tooth (127) · Worried (127) · wo (120) · Lip Bite (108) · BTC Coin (61) · Clown Mouth (57) · Flat (54) · Mon coin (48) · Grit (47)
- **Eyes** — 58 values · on 1959 tokens · ABSENT on 10: Happy (121) · Side Eye (101) · Purple laser (96) · fire laser (95) · Dead (78) · Round (77) · Normal Eye (74) · Heart (72) · Round Crying (69) · Green laser (68) · Round Tear (65) · Anime Glass (64) · Round Eye (61) · Gradient visor (61) · Closed Eye Crying (57) · Retro Glass (56) · Tired (56) · Teary (54) · Sunset visor (53) · Plasma visor (43) · Flat (34) · Angry (34) · Vertical (34) · Base (33) · Smirk (32) · MOG (32) · Frog (29) · Clown Eye (27) · Modern VR (26) · Chog Viper (26) · Clown Eye Mix (25) · Classic VR (25) · XD (25) · Retard (24) · Worried (22) · 3D Glass (22) · BTC Glass (19) · cyan laser (18) · Thug (17) · Red Round Eye (4) · Green Side Eye (3) · Blue Retard (3) · Up (2) · Mixed Retard (2) · Blue Round Eye (2) · Mixed Happy (2) · Mixed Side Eye (2) · Red Flat (2) · Green Happy (2) · Normal (2) · Blue Flat (1) · Red Retard (1) · Green Round Eye (1) · Green Smirk (1) · Green Retard (1) · Mixed Round Eye (1) · Blue Happy (1) · Blue Smirk (1)
- **Head** — 66 values · on 1716 tokens · ABSENT on 253: Mon Cap (70) · Russian Hat (67) · Balls Cap (62) · Horny Cap (58) · Crown (54) · Choggie Cap (51) · Durag (50) · TISM Cap (49) · Cloud Cap (49) · Blue Bucket Cap (48) · Wizard Hat (47) · Boob Cap (46) · Bob Hair (45) · Orange Bucket Cap (45) · Dollar Cap (44) · Thunder Cap (41) · Star Cap (40) · Spartan Helmet (40) · Red Peace Cap (38) · Gray Bucket Cap (38) · Peace hat (38) · BTC Cap (37) · MCGA (35) · MMGA Cap (34) · Red Headband (34) · Chog Cap (33) · MEGA Chog (31) · Japan Headband (31) · Buttcoin Cap (31) · Clown Nose (31) · Wizard Beanie (30) · 10k TPS Cap (30) · JEET Cap (30) · RETARD Cap (27) · Choggie Beanie (27) · Plumber (25) · BTC Beanie (25) · WAGMI Cap (25) · RH Beanie (25) · Robber (24) · NEET (24) · Mon Beanie (21) · MCGA Cap (21) · Rainbow Wig (18) · Red Horn (5) · 3rd Eye (4) · Silver wreath (4) · BOOB Cap (3) · Gold Thorn (3) · Holy Seal (3) · Demon Horn (3) · Silver Thorn (2) · Purple Horn (2) · ETH Cap (2) · Void Horn (2) · Taped Banana (2) · Diamond (2) · Red Bandana (2) · Peace Cap (1) · Head Wrap (1) · 8 Ball Beanie (1) · Blue Laser (1) · Poison Shroom (1) · Jeet Cap (1) · devil horn (1) · Mafia Hat (1)
- **Accessory** — 9 values · on 195 tokens · ABSENT on 1774: Fwog (28) · Coin (26) · SB (26) · Cigar (25) · Green Candle (23) · Heart (18) · Knife (18) · Red Candle (18) · PEPE (13)
- **Aura** — 22 values · on 974 tokens · ABSENT on 995: Burning Aura (82) · Fiery Aura (72) · Aqua Aura (67) · Rose Aura (65) · Purple (62) · Mint (61) · Light Purple (60) · Wind (60) · Clean (59) · Royal Blue Aura (57) · Smoke (57) · Cool Aura (56) · Violet (52) · Yellow Aura (49) · Fire (48) · Royal Aura (45) · Green Aura (8) · Rose Scent (5) · Pink Mist (3) · Royal Blue (3) · Electric Shock (2) · White Aura (1)
- **Form** — 2 values · on 1959 tokens · ABSENT on 10: Chog (1899) · Skull (60)
- **Tier** — 5 values · on 1969 tokens · ABSENT on 0: Common (1279) · Uncommon (590) · Rare (60) · Epic (30) · Legendary (10)
- **Naked** — 2 values · on 1959 tokens · ABSENT on 10: No (1905) · Yes (54)

**Sanity numbers for tests:** 1,969 tokens · tiers 1279/590/60/30/10 · 974 tokens with Aura · 195 with Accessory · 207 without Body · 253 without Head · 165 without Mouth.

---

## §D. PRODUCT SPECIFICATION

### D1. Non-negotiable judge journey (no wallet anywhere in steps 1–14)

1 Land on CHOG//BREAK → 2 see **ENTER THE LAB** → 3 browse/search/filter real Chogs → 4 pick Parent A → 5 pick Parent B → 6 press **SPLICE** → 7 short malfunction sequence → 8 deterministic mutant → 9 see which real parent traits produced which abilities → 10 press **FIGHT** → 11 fight a bot immediately → 12 knock it off or lose → 13 results → 14 mutant saved to Lab Notebook → 15 offered: **Rematch · Change one parent · New experiment · Share**.

### D2. Screens

1. **Home** — Hero **CHOG//BREAK**; subline **"Pick two Chogs. Splice them. See what goes wrong. Then fight it."**; primary **ENTER THE LAB**; secondary **MY CHOGS** (P1) and **TRY A SECRET MUTATION**; small line **"1,969 real Chogs. 1,937,496 possible pairings."** No blockchain jargon on the landing screen.
2. **Lab** — Parent A chamber, Parent B chamber, prominent SPLICE (free), RECORDED SPLICE (P1, only with wallet), collection browser.
3. **Collection browser** — virtualized grid of thumbnails, search by display name, name number or token ID, filters by trait category → value (**filters generated from the manifest, never hard-coded**), Random button, MY CHOGS tab (P1). Clicking a Chog shows its traits and the genes each trait gives.
4. **Reveal** — §D6.
5. **Pre-match** — both mutants, their moves, active arena modifiers ("⚠ THIS EXPERIMENT IS UNSTABLE"), controls overlay (always shown before the first fight), difficulty picker (Normal default), mode (Vs Bot / Local 2P in P1).
6. **Arena** — §D7.
7. **Results** — winner, KOs, damage dealt, time; **Rematch · Change one parent · New experiment · Share (P1)**.
8. **Lab Notebook** — mutant card, parent cards, W–L record, recipe badge, Unstable badge, Fight and Share buttons. "SECRET MUTATIONS: N / ???" (never show the total). Undiscovered: `??? + ??? = UNKNOWN`.
9. **MY CHOGS** (P1) — §D9.

**Deep links:** `/?a=1053&b=88` (token IDs) opens the Lab with those parents and runs the reveal. Add `&fight=1` to go straight to pre-match. Invalid IDs → friendly error, Lab still works.

**TRY A SECRET MUTATION:** picks one of the curated recipe pairs from `docs/RECIPE_EXAMPLES.md` (stored in `src/config/game.ts` as token-ID pairs verified against the manifest) and runs the reveal.

### D3. Pair, seed and determinism (`src/core/pair.ts`, `rng.ts`)

- Parents are two **different** token IDs `a`, `b` in 1..1969. Same token twice → rejected with a friendly message ("A Chog can't be spliced with itself").
- `lo = min(a,b)`, `hi = max(a,b)`; **pair(A,B) ≡ pair(B,A)**.
- `pairKey = keccak256(abi.encode(address CHOG_GENESIS, uint256 lo, uint256 hi))` — TS: viem `encodeAbiParameters` + `keccak256`. Must equal the contract's value. Shared vectors in `tests/fixtures/pairkey-vectors.json` (≥ 6 pairs, including (1,2), (1,1969), (1968,1969)) used by both Vitest and Foundry.
- RNG: **sfc32**, seeded from the first 16 bytes of `pairKey` (four big-endian uint32). Derive independent sub-streams per purpose by hashing `pairKey` with a label: `seedFor(label) = keccak256(concat(pairKey, toHex(label)))` with labels `"genes"`, `"name"`, `"visual"`, `"arena"`.
- Nothing in core may depend on time, wallet, ownership, block numbers or browser state. **Changing ownership never changes what A×B produces.** v1 output is stable forever; if the algorithm must change, bump `CORE_VERSION` and keep v1 reproducible.

### D4. Genes — real traits → gameplay (`src/core/genes.ts`)

**Inheritance:** for each slot (Eyes, Head, Mouth, Body, Base, Accessory, Aura) draw one bit from the `"genes"` stream to choose `lo` or `hi`. **Recessive rule:** if the chosen parent's value is `none` and the other parent's isn't, take the other's. Always draw the bit (keeps the stream stable). **Naked:** if the inherited Body comes from a parent with Naked = "Yes", the mutant is Naked → Body gene LIGHT. **Skin:** not inherited as a gene; both parents' Skin values blend into the visual tint; Metal skin on either parent adds the METAL modifier (§D4.6).

Every normalized value in §C3 must map to exactly one gene per slot; a test iterates the **real manifest** and fails on any unmapped value. Matching is on normalized values; "contains 'laser'" style rules are allowed only where written below. Numbers are starting values to tune in Phase 4; the *kinds* of effects are fixed.

**D4.1 Eyes → SPECIAL (key L, cooldown 3–6 s)** · real distribution: SPIT 711 · BLINK 386 · BEAM 277 · TEARS 245 · CHAOS ORB 186 · RAGE 92 · LEECH 72
| Gene | Normalized values | Effect |
|---|---|---|
| BEAM | any Eyes value containing `laser` (purple/fire/green/cyan laser). Not the Head value "blue laser" | Horizontal laser after 0.3 s charge. Colour from trait. Telegraphed |
| BLINK | gradient visor, sunset visor, plasma visor, modern vr, classic vr, anime glass, retro glass, 3d glass, btc glass, thug | Short invulnerable dash-teleport |
| TEARS | round crying, round tear, closed eye crying, teary | Lobs 2 tears that leave slippery puddles (4 s) |
| LEECH | heart | Lunge punch, heals 50% of damage dealt |
| RAGE | angry, mog, chog viper | 4 s: +30% damage dealt, +15% damage taken |
| CHAOS ORB | dead, xd, clown eye, clown eye mix, and every value containing `retard` | Bouncing orb with seeded unpredictable bounces |
| SPIT | every other Eyes value, and `none` | Straight projectile |

**D4.2 Head → DEFENSE/RECOVERY** · ROYAL 68 · GUARD 90 · WARP 81 · HORNS 71 · LIGHTWEIGHT 253 · STEADY 1406
| Gene | Values | Effect |
|---|---|---|
| ROYAL | crown, silver wreath, gold thorn, silver thorn, holy seal, diamond | 15% less knockback taken |
| GUARD | spartan helmet, plumber, robber, mafia hat | On ground, holding K blocks (−70% damage, breaks after 25 dmg) instead of dashing |
| WARP | wizard hat, wizard beanie, 3rd eye | Recovery (W after double jump) is a short teleport |
| HORNS | red horn, demon horn, purple horn, void horn, devil horn, horny cap | Recovery is an upward horn charge that hits |
| LIGHTWEIGHT | `none` | +10% speed, +10% knockback taken |
| STEADY | every other value | Baseline |

**D4.3 Mouth → CLOSE MOVE (key I, cooldown 1.5–4 s)** · HEADBUTT 1179 · COIN TOSS 236 · DROOL 184 · BUBBLE 168 · PUKE 145 · HONK 57
| Gene | Values | Effect |
|---|---|---|
| PUKE | rainbow puke | Short rainbow cone, multi-hit |
| DROOL | drooling | Slippery puddle at feet (5 s) |
| BUBBLE | bubblegum | 1.2 s bubble shield; in air, slows falling |
| COIN TOSS | gold tooth, btc coin, mon coin | Arcing coin projectile |
| HONK | clown mouth | Radial honk, 0.4 s stun at close range |
| HEADBUTT | every other value, and `none` | Quick headbutt |

**D4.4 Body → PHYSICS** · BALANCED 1505 · LIGHT 207 · HEAVY 116 · SLIPPERY 54 · DASHER 48 · FLOATY 39
| Gene | Values | Effect |
|---|---|---|
| HEAVY | golden armor, mummy, kings robe, wizard, wizard cape, jesus, jesus robe | Weight 1.3, speed 0.88 |
| FLOATY | astro suit, sci fi | Gravity 0.7, jump 1.1 |
| DASHER | shark suit, dragon suit | Dash distance 1.4, dash cooldown −30% |
| SLIPPERY | banana suit, duck float | Friction 0.4; immune to puddles |
| LIGHT | `none`, or mutant is Naked | Weight 0.8, speed 1.15 |
| BALANCED | every other value | Baseline |

**D4.5 Base → MUTATION AFFINITY** · NORMAL 1869 · UNDEAD 60 · TOXIC 30 · ANOMALY 10
| Gene | Value | Effect |
|---|---|---|
| UNDEAD | skull | First KO each match: revive in place at 60% instead of losing a life |
| TOXIC | radioactive | Aura dealing 1 dmg/s to opponents within 90 px |
| ANOMALY | 1:1 | Heavy glitch visual; special cooldown −15% |
| NORMAL | origin | — |

**D4.6 Skin modifier:** METAL — either parent's Skin = metal → +0.1 weight. All other skins: visual tint only.

**D4.7 Accessory → TRINKET** · NONE 1774 · CHARM 90 · FWOG 28 · PUMP 23 · SHIV 18 · REGEN 18 · DUMP 18
| Gene | Values | Effect |
|---|---|---|
| SHIV | knife | Punches +15% damage |
| FWOG | fwog | A little frog helper hops at the opponent every 6 s (2 dmg) |
| PUMP | green candle | Every 10 s grow 20% for 3 s (+weight, +reach) |
| DUMP | red candle | Every 10 s shrink 20% for 3 s (+speed, −weight) |
| REGEN | heart | Heal 1% damage every 2 s |
| CHARM | cigar, coin, sb, pepe | Cosmetic particle only |
| NONE | `none` | — |

**D4.8 Aura → ELEMENT (passive)** · NONE 995 · GLOW 303 · BURN 202 · FROST 123 · SHIELD 105 · BLOOM 73 · GUST 60 · SMOKE 57 · SHOCK 51
| Gene | Values | Effect |
|---|---|---|
| BURN | burning aura, fiery aura, fire | Dashing leaves a fire patch (2 s, 1 dmg / 0.5 s) — telegraphed, hurts only the opponent |
| FROST | aqua aura, cool aura | Your hits slow the target 20% for 1 s |
| GUST | wind | Dash pushes nearby opponents |
| SMOKE | smoke | Dash leaves a smoke puff; hidden 1 s |
| SHOCK | electric shock, yellow aura | Third hit of the punch combo stuns 0.2 s |
| SHIELD | royal aura, royal blue aura, royal blue | First hit each life deals 50% less |
| BLOOM | rose aura, rose scent, pink mist | Heal 1% every 2 s |
| GLOW | every other Aura value (purple, mint, light purple, clean, violet, green aura, white aura…) | Cosmetic aura glow only |
| NONE | `none` | — |

**D4.9 Power budget (rarity ≠ strength):** each gene has a `power` score in `genes.ts` (baseline 0, others −1…+2). A test enumerates **every** gene combination and asserts total power ∈ [−2, +5] and that **Tier changes no stat**. A Common mutant must be able to beat a Legendary mutant. Tier affects visuals only (glitch intensity, particles) and the UNSTABLE KNOCKBACK modifier rule.

### D5. Naming, Unstable, recipes

- **Names** (`naming.ts`): recipe → fixed recipe name. Otherwise `{prefix} {noun}` from the `"name"` stream: prefix list keyed by Eyes gene, noun list keyed by Body gene, ≥ 12 words each, short and memeable ("Laser Goblin", "Soggy Brute"). Banned: Nexus, Quantum, Neural, Cyber, Omni, Hyperion. Display also `EXPERIMENT #lo×hi`.
- **Unstable** (`unstable.ts`, deterministic): `u = uint32(keccak256(concat(toHex("CHOG_BREAK_UNSTABLE_V1"), pairKey))[0..4]) % 1000; unstable = u < 50` (5% of pairs). Visual only (holo shimmer + "UNSTABLE" stamp) and it adds the UNSTABLE KNOCKBACK arena modifier. Never described as random, lucky, or secure.
- **Recipes** (`recipes.ts`): match when the condition holds **across the pair** (one parent has X, the other has Y, either order). Override the name, add a unique visual, add one perk that stays inside the power budget. Every recipe below was checked against the real collection; the pair counts are real.

**P0 recipes (ship first, polished):**
| Recipe | Condition (normalized) | Perk | Real pairs |
|---|---|---|---|
| KING BEAM | Eyes contains `laser` + Head `crown` | Beam pierces and is 20% wider | 14,930 |
| NUCLEAR UNDEAD | Base `skull` + Base `radioactive` | UNDEAD revive also releases a toxic burst | 1,800 |
| THE NAKED KING | Naked `yes` + Head `crown` | Taunt (hold I 1 s) → 2 s super armor | 2,916 |
| ARCHMAGE | Head `wizard hat`/`wizard beanie` + Body `wizard`/`wizard cape` | Warp leaves a damaging rune | 2,232 |
| VOLATILITY | Accessory `green candle` + Accessory `red candle` | Grows/shrinks every 5 s | 414 |
| FWOG LORD | Accessory `fwog` + Eyes `frog` | Two frog helpers | 809 |
| ESCAPE VELOCITY | Body `astro suit` + Head `10k tps cap` | Triple jump | 720 |
| WILDFIRE | Aura `burning aura`/`fiery aura`/`fire` + Eyes `fire laser` | Beam leaves a fire trail | 19,099 |

**P1 recipes:**
| Recipe | Condition | Perk | Real pairs |
|---|---|---|---|
| LASER SHOW | two *different* laser Eyes values | Beam fires twice, both colours | 26,770 |
| GOLDEN BULL | Body `golden armor` + Accessory `green candle` | Dash has super armor | 390 |
| BEAR MARKET | Accessory `red candle` + Mouth `sad` | Opponent takes +5% damage while you're above 100% | 3,311 |
| SKULL & BONES | Base `skull` + Accessory `knife` | Combo ender launches upward | 1,080 |
| SHARK WEEK | Body `shark suit` + Mouth `drooling` | Drool puddle bites | 4,585 |
| HONK LORD | Mouth `clown mouth` + Head `clown nose` | Honk stun +0.2 s | 1,767 |
| DOUBLE RAINBOW | Mouth `rainbow puke` + Head `rainbow wig` | Longer puke cone | 2,604 |
| BTC MAXI | Eyes `btc glass` + Head `btc cap`/`btc beanie` | +10% speed | 1,157 |

If two recipes match, the one listed first wins (deterministic). Phase 1 must re-count every recipe against the generated manifest and write one example pair (token IDs) per recipe to `docs/RECIPE_EXAMPLES.md`.

### D6. Splice reveal and mutant art

**Reveal (3–5 s; SKIP available after the first one; reduced-motion → 1 s crossfade):** chamber locks → warning light → current spike → art flashes between A and B → glitch → screen shake → smoke/particles → doors open → mutant → name → inherited traits with "from #A / from #B" labels and the gene each trait gave → recipe banner / UNSTABLE stamp if any.

**Art pipeline:**
- `scripts/build-sprites.ts` downloads each token's image (gateway fallback, resumable), removes the flat background by flood-filling from the corners with colour tolerance, outputs `public/chogs/{tokenId}.webp` (256 px, transparent) and `thumbs/{tokenId}.webp` (96 px), and records `bgRemoved` per token. If removal leaves < 25% or > 85% opaque pixels, keep the original and set `bgRemoved:false` (renderer frames it in a specimen jar). Report total size (target < 40 MB). **Same-origin art = no CORS problems and no IPFS failures during judging.**
- Before writing the compositor, inspect at least 25 real sprites across tiers and forms (Origin, Skull, Radioactive, 1:1, Naked) and record canvas size, character position, face/body regions in `docs/DECISIONS.md`.
- `src/art/mutantRenderer.ts` (canvas, driven only by `mutant.visualRecipe` from core — no independent randomness): Parent A base; Parent B inserted via a deterministic mask (jagged seam at 40–60% height, which parent is on top from the `"visual"` stream); glitch bands at the seam; light chromatic aberration; ≤ 25° hue shift toward the blended skin tint; recipe outline/glow; Unstable holo shimmer; specimen stamp. **Not** a 50/50 crossfade — both parents must be visibly present.
- **Fallback sprite** (`fallbackSprite.ts`): if art fails, draw a simple rounded creature tinted by skin colour with a small "art offline" tag. Never crash.

### D7. Arena

**Feel:** Smash-style knockback + party chaos. Bouncy, readable, funny, responsive. Not a precise fighting game.

**Stage:** logical 1280×720, scaled. One main platform (~800 px) + 3 pass-through floating platforms. Kill zones 200 px beyond the sides and top, and below the stage. Dark lab background with subtle animated scanlines (code-drawn).

**Rules:** 2 fighters · **2 lives** each · damage % from 0 · knockback = `(base × attackPower + damage% × scaling) × modifiers ÷ weight`, capped; no unavoidable kill below ~60% · exiting a kill zone = lose a life **exactly once** · respawn with 2 s invulnerability (flashing) · match timer 120 s → more lives wins, then lower damage %, then sudden death at 150%.

**Feel requirements (spend real time here):** hit flash, 40–80 ms hitstop, particles, knockback trail, screen shake on big hits, impact SFX, floating damage numbers, squash & stretch on jump/land, lean on run.

**Controls** (shown on pre-match screen):
| Action | Player 1 | Player 2 (P1, local) |
|---|---|---|
| Move | A / D | ← / → |
| Jump / double jump / recovery | W | ↑ |
| Drop through platform | S | ↓ |
| Punch (3-hit combo on repeat) | J | `,` |
<!-- Player 2 keys avoid the numpad on purpose: many laptops don't have one. Test on a real laptop keyboard; if a key conflicts, change it and record the change in DECISIONS.md -->
| Dash (Guard for GUARD heads) | K | `.` |
| Special (Eyes) | L | `/` |
| Close move (Mouth) | I | `M` |
Desktop keyboard is the judging target. On touch devices show "Best on desktop with a keyboard"; the Lab still works on phones.

**Arena modifiers ("the arena mutates too")** — collected from the **Background** of all four parents in the match (deduplicated) plus the tier/Unstable rule; the `"arena"` stream (seeded from both pairKeys, order-independent) picks at most **2** background modifiers, plus UNSTABLE KNOCKBACK if it applies (max 3). **They affect everyone**, including the player who brought them (NFT as rule-modifier, not pay-to-win). Every modifier needs a telegraph, a readable effect, counterplay, and no unavoidable instant death.

| Modifier | Source | Tier |
|---|---|---|
| TOXIC FLOOR — segments of the main platform glow, then hurt (1 dmg/0.5 s) for 3 s, rotating | Background `radioactive` | **P0** |
| SLIPPERY FLOOR | aqua, aqua mint, aqua blue, deep aqua, deep blue, sky blue, royal blue, noble blue | **P0** |
| LOW GRAVITY | mon, light purple, soft lavender, deep purple, supreme purple | **P0** |
| UNSTABLE KNOCKBACK — knockback ×1.35 | any of the 4 parents is Epic/Legendary, or either mutant is Unstable | **P0** |
| OVERCLOCK — everyone +20% speed | lemon, lemon yellow, bright yellow, sunlight | P1 |
| BOUNCY FLOOR | rosie, coral pink, peach pink, rosy pink, rose pink, light magenta, magenta | P1 |
| SHRINKING STAGE — main platform shrinks after 60 s | mint, fresh green, lime green | P1 |
| METEOR SHOWER — telegraphed falling rocks | red sky, blood red, afternoon orange | P1 |
| COIN RAIN — falling coins heal 5% | gold | P1 |
| GLITCH — a random implemented modifier every 20 s | background `none` | P1 |

Until a P1 modifier exists, its backgrounds contribute nothing (never show an unimplemented modifier). If no modifier applies, show **"STABLE… FOR NOW"**.

**Bot** (`arena/bot.ts`): transparent finite-state machine (`APPROACH → ATTACK → SPACE → RECOVER → EDGEGUARD`), no ML, no external AI. Uses its mutant's real moves. **Easy:** 400 ms reaction, weak recovery, frequent mistakes. **Normal (default):** 220 ms, chases, understands edges, recovers reasonably, uses abilities sometimes. **Hard:** 110 ms, better spacing and recovery, more abilities, aggressive when the player's damage is high. Must never freeze or loop against a wall. Default opponent: a mutant from a pair seeded by the UTC date (consistent per day), shown pre-match.

### D8. Lab Notebook (`state/notebook.ts`)

localStorage key `chogbreak.notebook.v1`; every read/write in try/catch; the app works with storage blocked. Entry: `{ pairKey, lo, hi, name, recipeId?, unstable, discoveredAt, wins, losses, recordedTx? }`. Keyed by `pairKey` → no duplicate reversed pairs.

### D9. Wallet, holder mode, Recorded Splice (P1)

**Wallet (`chain/client.ts`):** connect via injected provider; if not chain 143, offer **Switch to Monad** (`wallet_switchEthereumChain`, then `wallet_addEthereumChain` with verified params). The wallet never blocks guest features.

**Ownership (`chain/ownership.ts`):** `balanceOf(user)`; if 0, stop (no scan). Otherwise Multicall3 `aggregate3` over `ownerOf(1..1969)` in chunks of 250 (allowFailure), compare to user, stop early when the count matches. Show "Finding your Chogs…" with progress; cache for the session; clear retry state on RPC failure. Never fabricate holdings. Never trust a client-claimed owner.

**MY CHOGS page:** per owned Chog: image, display name + token ID, traits, genes it contributes, notebook experiments using it, known recipes it's part of, and (only once the registry is deployed and working) on-chain usage count and $CHOG received.

**FREE EXPERIMENT vs RECORDED SPLICE** (use these exact names; the difference must be obvious and the free mode must never feel crippled):
- FREE EXPERIMENT: no wallet, no transaction, full mutant, full fight, local notebook, no permanent record.
- RECORDED SPLICE: wallet on Monad, pays the $CHOG fee, permanently records the pair, first valid recording gets **first-discoverer** credit, pays the two parent owners.

**Recorded Splice UI flow (`chain/registry.ts`):** check chain → read `fee()`, user's $CHOG balance and allowance → if allowance < fee, request `approve(registry, fee)` (**exact amount, never unlimited**) → simulate `recordSplice(a,b)` → show amount and where it goes (35% owner of #lo, 35% owner of #hi, 20% prize pool, 10% to the dead address) → user confirms in wallet → wait for receipt, check `status === success`, decode events → show "FIRST DISCOVERY!" if applicable → save `recordedTx` in the notebook.

**Error copy (`chain/errors.ts`):** RPC slow → "Monad is taking too long to respond. Retry." · wrong chain → "Switch to Monad" · rejected → "Experiment cancelled. Nothing was recorded." · insufficient $CHOG → show required vs available · insufficient MON → "You need a little MON for gas." Never show raw stack traces.

### D10. Smart contract — `contracts/src/ChogBreakRegistry.sol` (Reviewer-owned, P1)

Small on purpose. **Not on-chain:** fighting, art, physics, trait mappings, leaderboards, randomness.

```
immutable IERC721 CHOG_GENESIS; immutable IERC20 CHOG_TOKEN; immutable uint256 MAX_FEE
uint256 fee; address prizeRecipient
uint16 constant OWNER_BPS = 3500;   // each parent owner
uint16 constant PRIZE_BPS = 2000;
uint16 constant BURN_BPS  = 1000;   // sent to 0x000000000000000000000000000000000000dEaD (disclosed). If Phase 0 proves $CHOG has a real, standard burn(), Reviewer may propose using it (STOP 5).
address constant DEAD = 0x000000000000000000000000000000000000dEaD;

mapping(bytes32 => address) firstDiscoverer;
mapping(bytes32 => uint64)  firstDiscoveryTime;
mapping(bytes32 => uint256) pairSpliceCount;
mapping(uint256 => uint256) tokenUsageCount;
mapping(uint256 => uint256) tokenEarned;

function recordSplice(uint256 a, uint256 b) external nonReentrant whenNotPaused
  require(a != b); (lo,hi) = sorted   // no hard-coded range: ownerOf below reverts for tokens that don't exist
  ownerLo = CHOG_GENESIS.ownerOf(lo); ownerHi = CHOG_GENESIS.ownerOf(hi)   // resolved on-chain, never from the client
  pairKey = keccak256(abi.encode(address(CHOG_GENESIS), lo, hi))
  shareLo = fee*OWNER_BPS/10000; shareHi = same; burned = fee*BURN_BPS/10000
  prize = fee - shareLo - shareHi - burned                               // remainder → no dust lost
  // effects first
  first = firstDiscoverer[pairKey] == address(0)
  if first: firstDiscoverer[pairKey] = msg.sender; firstDiscoveryTime[pairKey] = uint64(block.timestamp); emit PairDiscovered(pairKey, lo, hi, msg.sender)
  pairSpliceCount[pairKey]++; tokenUsageCount[lo]++; tokenUsageCount[hi]++; tokenEarned[lo]+=shareLo; tokenEarned[hi]+=shareHi
  // interactions (SafeERC20.safeTransferFrom from msg.sender), skip zero amounts
  → ownerLo shareLo · → ownerHi shareHi · → prizeRecipient prize · → DEAD burned
  emit SpliceRecorded(msg.sender, lo, hi, pairKey, ownerLo, ownerHi, fee, shareLo, shareHi, prize, burned, first)

function setFee(uint256) onlyOwner          // ≤ MAX_FEE; emit FeeUpdated
function setPrizeRecipient(address) onlyOwner  // != 0; emit PrizeRecipientUpdated
function pause()/unpause() onlyOwner
```
OpenZeppelin v5: `Ownable2Step`, `ReentrancyGuard`, `Pausable`, `SafeERC20`. No upgradeability, no `delegatecall`, no `selfdestruct`, no token rescue. Fee may be 0 (records still work). If the same wallet owns both parents it simply receives both shares. The prize pool goes to a plain recipient address; **automatic weekly distribution is roadmap, never claimed.**

**Required Foundry tests:** pair order normalization · same pair same key · TS/Solidity pairKey vectors (shared fixture) · same token rejected · nonexistent token (e.g. 0 and 1970 on the mock) rejected via ownerOf · first discoverer set once and time recorded · second splice increments count, `first == false` · exact fee accounting for odd fees (no dust) · ownerLo payout · ownerHi payout · same owner receives both shares · prize allocation · dead-address allocation · zero fee path · insufficient allowance fails · insufficient balance fails · reentrancy attempt via malicious token mock fails · owner cannot be spoofed by caller input · paused blocks `recordSplice` · only owner can setFee / setPrizeRecipient / pause · setFee above MAX_FEE fails · events carry correct args. Mocks only in tests. Run `forge fmt && forge build && forge test -vvv`; `forge coverage` ≥ 90% lines on the registry.

**Fork tests (opt-in, need network):** against chain 143: `ownerOf(1)` succeeds; $CHOG transfer delivers exactly the amount sent (no fee-on-transfer); `decimals()` recorded. If the sandbox has no network, write them, mark them skipped, list under "Needs human verification".

**Deployment (`script/Deploy.s.sol` + `docs/DEPLOY.md`):** env `MONAD_RPC_URL, CHOG_NFT_ADDRESS, CHOG_TOKEN_ADDRESS, LAB_FEE, MAX_FEE, PRIZE_POOL_RECIPIENT, OWNER`. Aborts unless `CONFIRM_MAINNET_DEPLOY=YES` **and** chain ID is 143. Before broadcasting it prints chain ID, deployer, deployer MON balance, NFT address, token address, fee (raw and human units using real decimals), max fee, prize recipient, owner — and `DEPLOY.md` tells Maris to read it before confirming. Maris signs with her own keystore (`--account`), never a raw key in a file the agents can read. Suggested starting values (Maris decides — STOP 5): fee **100 $CHOG**, max fee **10,000 $CHOG**. After deployment Maris gives the address + tx hash; Builder puts them in `src/config/chain.ts` with the tx hash as a comment.

### D11. Share card (P1)

`src/art/shareCard.ts`: 1200×675 PNG — mutant art, name, `#lo × #hi`, gene icons, recipe/Unstable badge, W–L, CHOG//BREAK wordmark, deep link text. Buttons: **Download PNG** and **Post on X** (opens `https://twitter.com/intent/tweet?text=…&url=…` with the deep link). Never auto-posts. **Not done until a real pair exports a valid PNG in a real browser.**

### D12. Daily modes (P2)

Daily seed = keccak256(`"CHOG_BREAK_DAILY_V1|" + UTC date YYYY-MM-DD`). **Daily Experiment:** one goal per day from a fixed list (e.g. "Win with a BEAM special and a ROYAL head", "Discover any secret mutation", "Win under LOW GRAVITY"); completion + streak in localStorage. **Daily Chaos:** a fixed modifier set for everyone that day. No server randomness.

### D13. Look, sound, accessibility, performance

- **Identity: chaotic failed lab + Chog humour.** Dark lab surfaces, hazard stripes used sparingly, CRT/status displays, physical-looking switches and buttons, specimen cards, warning labels, strong display typography + monospace labels, sparks/smoke/glitch, high contrast. **Avoid:** generic Web3 gradients, glassmorphism, floating glowing card grids, corporate dashboards, long paragraphs, AI-generated illustrations. If a `frontend-design` skill is available, use it before Phase 2 UI work.
- **Sound** (synthesized): lab alarm, electricity, reveal impact, punch, big hit, KO, victory, UI click. Mute toggle persisted (try/catch).
- **Accessibility:** keyboard-navigable UI, visible focus, `prefers-reduced-motion` respected (shorter reveal, less shake), mute, WCAG AA contrast, never colour-only information, controls shown before the first fight, alt text on images.
- **Performance:** Lab interactive < 3 s on a normal connection (thumbnails only in grid, virtualized); arena 60 fps on an ordinary laptop; no network or chain call inside the game loop; no React re-render per tick.

### D14. Competitive differentiation (do not drift)

Public Chogathon entries already cover: **Chog Raid** (each Chog is a dungeon room), **ChogHub** (Chog as AI agent), **Chog Mischief** (daily prank war), **POSSESS** (save file follows the token), **Chog Chaos League** (shared meadow sim), **Chog Dash** (runner), **Chogforge** (museum), **Ryoko Chog** (journey), **Chog State** (scars). Don't copy their code or mechanics.
**Our difference:** *two existing NFTs become genetic inputs for a playable third entity, and the same genetic material also rewrites the arena's rules.* Do not drift back into "traits become stats and history follows the token" — that space is crowded.

### D15. Why the NFT is essential (must stay true in the final product)

The NFTs are the **ingredients**: their real metadata supplies the parents' identity, the mutant's genetics, its visual composition, its abilities, the secret recipes, the arena's rules, holder attribution, and (P1) parent-holder payouts. Remove Chog Genesis and the product disappears.

---

## §E. DATA PIPELINE (Phase 0)

1. `scripts/verify-chain.ts` → every §C2 row PASS/FAIL, output saved to `docs/CHAIN_CHECK.md`.
2. `scripts/build-manifest.ts` (tsx): confirm minted token IDs (via `Transfer` events from address 0 if logs are practical; otherwise `ownerOf` over 1..1969 and record any failures) → `tokenURI` per ID via Multicall3 → resolve IPFS with gateway fallback, concurrency ≈ 8, exponential backoff, resumable `.cache/` (git-ignored) → write `public/data/chogs.json`: `[{ tokenId, displayName, displayNumber, tokenUri, image, attributes (raw), traits (normalized, absent → "none") }]` sorted by tokenId.
3. Validate: exactly 1,969 unique token IDs 1..1969; every record has metadata; tier counts and per-category value counts match §C3. **Any mismatch = STOP 6.**
4. `scripts/trait-report.ts` → `docs/TRAIT_REPORT.md`: totals, ID set, missing metadata, malformed records, every category/value/count, gene mapping per value, recipe pair counts, any mapping rejected because its trait didn't exist.
5. `scripts/build-sprites.ts` (§D6).

**If your sandbox can't reach the RPC or IPFS:** write and unit-test the scripts with mocked fetch, then **HUMAN CHECKPOINT**: give Maris the exact commands (`npm run data:verify && npm run data:manifest && npm run data:report && npm run data:sprites`) and what to paste back / commit. Core code may be written against §C3 meanwhile, but no phase that depends on real data is "done" until the real manifest is committed.

---

## §F. PHASES, TIME BOXES, ACCEPTANCE

Start: Sun 18 Oct 2026. All times UTC. **FEATURE FREEZE: Wed 22 Oct 18:00. Submit by Thu 23 Oct 12:00** (3-hour buffer before the 15:00 deadline).

### Builder track

**Phase 0 — Setup + facts + data** (box: Sun 18 Oct, 12:00)
Scaffold (§B), scripts `dev build preview typecheck lint test test:e2e data:verify data:manifest data:report data:sprites`, `.gitignore` (node_modules, dist, .env*, .cache, contracts/out, contracts/cache, broadcast), `.env.example`, PROGRESS.md, DECISIONS.md, HANDOFF.md, data scripts (§E).
- [ ] `npm run build`, `typecheck`, `lint`, `test` pass on the scaffold
- [ ] `docs/CHAIN_CHECK.md` exists; every §C2 row verified or replaced with documented values
- [ ] `public/data/chogs.json` has 1,969 records and matches §C3; `TRAIT_REPORT.md` generated
- [ ] Sprites built, size reported (or HUMAN CHECKPOINT logged)

**Phase 1 — Deterministic core** (box: Sun 18 Oct, 23:59)
`src/core/*`: normalize, pair, rng, genes, splice, recipes, naming, unstable, arenaRules, budget. API:
```ts
const mutant = createMutant({ parentA, parentB })   // order-independent
// mutant: { coreVersion, pairKey, lo, hi, name, parents, inherited: {slot → {value, from}},
//           special, head, close, physics, affinity, metal, trinket, element,
//           recipe?, unstable, power, visualRecipe }
const rules = createArenaRules({ mutants: [m1, m2], tiers })   // order-independent
```
- [ ] Every real trait value maps to exactly one gene per slot (test iterates the real manifest)
- [ ] `createMutant(A,B)` deep-equals `createMutant(B,A)` for 1,000 seeded random pairs; stable across runs (snapshot of 20 fixed pairs)
- [ ] pairKey vectors file created; Vitest parity test passes
- [ ] Power budget test passes over every gene combination; Tier never affects stats
- [ ] Every recipe has ≥ 1 real pair; counts in TRAIT_REPORT; `docs/RECIPE_EXAMPLES.md` written; curated "TRY A SECRET MUTATION" pairs in `config/game.ts`
- [ ] Core purity check (no React/Phaser/DOM/Math.random/Date.now in `src/core`)

**Phase 2 — The Lab** (box: Mon 19 Oct, 23:59)
Home, collection browser (virtualized, search, manifest-derived filters), Lab chambers, SPLICE, reveal (§D6) with SFX and SKIP, mutant renderer, notebook, deep links, TRY A SECRET MUTATION, error/empty/loading states, reduced motion, mute.
- [ ] Playwright: home → lab → pick A → pick B → splice → reveal → notebook, no console errors
- [ ] Same deep link → identical mutant after reload and in a second browser profile
- [ ] Lab usable at 375 px; missing art shows fallback, no crash
- [ ] Reveal clearly shows which parent each trait/gene came from

**Phase 3 — Base fight + FUN GATE** (box: Tue 20 Oct, 18:00)
One arena, player vs bot, move/jump/double jump/drop-through/punch combo/dash, damage %, knockback, hitstun, hitstop, shake, particles, kill zones, 2 lives, respawn invulnerability, timer, HUD, results, rematch, bot (3 levels), clean teardown. **No mutant abilities yet** — every fighter uses BALANCED physics and no specials.
- [ ] Full match vs Normal bot start → results; rematch ×10 with no leaks, duplicate inputs/audio, phantom colliders or stale state
- [ ] Lives decrement exactly once per KO (unit test on the KO handler)
- [ ] Bot recovers to stage in ≥ 9/10 scripted off-stage launches; never freezes
- [ ] 60 fps measured and logged
- [ ] **FUN GATE (HARD):** Maris plays 5 matches and answers "would I press rematch?" — if no, fix feel (hitstop, knockback curve, speed, bot behaviour) before Phase 4. Record her verdict in PROGRESS.md. **HUMAN CHECKPOINT.**

**Phase 4 — Mutant gameplay** (box: Wed 21 Oct, 14:00)
**4A first (box Wed 21 Oct 08:00):** the high-traffic genes — Eyes BEAM, BLINK, TEARS, SPIT; Head ROYAL, WARP, LIGHTWEIGHT, STEADY; Mouth PUKE, BUBBLE, COIN TOSS, HEADBUTT; every Body profile; Base UNDEAD, TOXIC; the 4 P0 arena modifiers; the 8 P0 recipes; Unstable visuals; pre-match screen. Polish these until changing a parent visibly changes the fight. **4B (only once 4A is solid):** the remaining genes (LEECH, RAGE, CHAOS ORB, GUARD, HORNS, DROOL, HONK, ANOMALY, all Accessory and Aura genes). If 4B can't be finished with quality by the box, the unfinished genes fall back to their slot's default effect **and display the default gene's name** (e.g. a HONK mouth shows and plays as HEADBUTT) — never show a gene name whose effect doesn't exist. Record any fallback in PROGRESS.md and README.
- [ ] Every gene has a visible effect — one line per gene in PROGRESS.md with how it was verified
- [ ] Changing one parent visibly changes the mutant **and** its gameplay (demonstrated on 3 pairs)
- [ ] Each P0 modifier: telegraph, effect, counterplay checked
- [ ] Balance smoke test: headless bot-vs-bot, ≥ 200 seeded matches of random mutants; no gene above 65% win rate with n ≥ 30; table in PROGRESS.md
- [ ] Recipe detection order-independent (tests); every P0 recipe playable from TRY A SECRET MUTATION

**Phase 5 — P0 polish + release candidate** (box: Wed 21 Oct, 23:59) → **P0 DONE**
Hit feel, animation, sound pass, transitions, all loading/error/empty states, responsive pass, accessibility pass, meta tags/OG image/favicon, Vercel production deploy by Maris.
- [ ] §G1 P0 Definition of Done fully green on the **live URL**
- [ ] Playwright critical flow passes against the production build (home → lab → A → B → splice → reveal → fight → finish match (test hook may force a KO) → results → notebook), plus: filtering, notebook persists on refresh, malformed metadata record, missing image, RPC offline, 375 px viewport
- [ ] No console errors in the full guest flow

**Phase 6 — P1** (box: Wed 22 Oct, 16:00)
Order: (1) wallet + holder mode, (2) Recorded Splice UI wired to the deployed registry, (3) share card, (4) local 2-player, (5) P1 recipes, (6) P1 modifiers. Stop at the freeze wherever you are; unfinished P1 items are removed from the UI, not shown half-built. **If the contract or its deployment threatens the deadline, ship without Recorded Splice** — never sacrifice the playable loop for $CHOG integration.
- [ ] A real Monad wallet connects and lists exactly the Chogs it owns (Maris tests with her wallet)
- [ ] **HUMAN CHECKPOINT:** one real Recorded Splice on mainnet: receipt success, event decoded, FIRST DISCOVERY shown, both owners' balances changed by the expected amounts (Maris pastes explorer links into PROGRESS.md)
- [ ] Share card exports a valid PNG for a real pair in a real browser
- [ ] Local 2P: both control sets work simultaneously

**— FEATURE FREEZE Wed 22 Oct 18:00 UTC — only bugs, docs, demo, deployment, smoke tests after this —**

**Phase 7 — Submission package** (box: Thu 23 Oct, 10:00)
- `README.md`: one-sentence pitch · why Chog NFTs are essential (§D15, each point tied to code) · run locally · **Judge quick start (no wallet, 60 s)** with 3 deep links incl. one recipe · holder path · contracts + chain + explorer links · stack · architecture · determinism · trait mapping summary · security summary · known limitations (notebook is per-device; Unstable is deterministic, not random; bot not online play; prize pool is a plain address) · scope · testing · licenses/acknowledgements (all code written during the hackathon; open-source libraries listed; art from Chog Genesis metadata; no third-party audio).
- `docs/SUBMISSION.md`: text for every submission field (name, what you built, what's new, why Chog matters, testing instructions, tech stack, pre-existing work, user feedback/usage if any, what's next), description ≤ 8,000 characters.
- `docs/DEMO_SCRIPT.md` (≤ 3:00): 0:00–0:12 "There are 1,969 Chog Genesis NFTs. We turned them into genetic material." · 0:12–0:35 browse, filter Head → Crown, pick; filter Eyes → laser, pick · 0:35–0:55 SPLICE, malfunction, **KING BEAM** reveal · 0:55–1:12 parents, real traits, inherited moves · 1:12–2:05 fight the bot: punch, knockback, special, arena modifier, KO · 2:05–2:25 notebook; change one parent → different mutant · 2:25–2:42 wallet + MY CHOGS · 2:42–2:55 Recorded Splice on-chain + first discovery (only if deployed) · 2:55–3:00 "1,969 Chogs. Millions of experiments. SPLICE. BREAK. REPEAT."
- [ ] Fresh clone → `npm ci` → `npm run build` succeeds
- [ ] Live URL passes the guest checklist; no placeholder text, "coming soon" buttons, TODOs, dead links or fake data visible (§G3)

### Reviewer track (in parallel)

- **R1 (Sun 18 Oct):** independently run the §C2 checks and compare with Builder's `CHAIN_CHECK.md`; review `src/core` for determinism (hidden randomness, order dependence, unmapped values); write `tests/review/` property tests (order independence, stability, budget); create the pairKey vectors with Foundry so both suites share them.
- **R2 (Mon 19 – Tue 20 Oct):** build `ChogBreakRegistry.sol`, full Foundry suite, fork tests, Deploy script with the mainnet guard, `docs/DEPLOY.md`. Hand Maris the deploy steps by **Tue 20 Oct 23:59** so mainnet deployment can happen Wed 21 Oct.
- **R3 (Wed 21 Oct):** `docs/SECURITY.md` — approvals (exact amount), transfers, reentrancy, ownership resolution, admin powers, fee accounting/rounding, pair replay (recording a pair twice is allowed and only increments counts), dead-address behaviour, RPC spoofing assumptions, event correctness, frontend address config, secret exposure. Review `src/chain/**` against the ABI.
- **R4 (Wed 22 – Thu 23 Oct):** run the full guest and holder flows on the live URL, check every README/SUBMISSION claim against the code, and flag any overclaim as HIGH.

---

## §G. DEFINITIONS OF DONE

### G1. P0 DONE — only when ALL are true (on the live URL)
production site loads · all 1,969 Chogs browsable · filters work · two real Chogs selectable · same pair → same mutant · reversed pair → same mutant · mutant art visibly contains both parents · real traits shown with their source parent · a secret recipe works · reveal looks intentional · FIGHT opens · controls work · bot works on all levels · punch/dash work · damage and knockback work · lives work · match ends correctly · results work · rematch works · notebook works and survives refresh · changing a parent changes the mutant · no wallet required anywhere · no console-breaking error · production build succeeds.

### G2. P1 DONE
wallet connects · chain enforcement works · owned Chogs detected accurately · holder can splice their own Chog · local 2P works · share card exports · all contract tests pass · deployed address is real and shown with explorer link · a Recorded Splice succeeds with a verified receipt · discovery appears in the UI · owner payouts verified correct.

### G3a. README / SUBMISSION HONESTY
Never claim: secure randomness · something is on-chain when it isn't · live online multiplayer · payouts if the registry isn't deployed · a burn when tokens only went to a dead address (say "sent to the dead address") · NFT copyright ownership · that every trait is unique when traits share archetypes · full decentralization (the frontend is hosted centrally).

### G3. NO-PLACEHOLDER RULE (before submission)
No lorem ipsum, fake usernames, fake tx hashes, "coming soon" in the primary flow, dead links, fake earnings, simulated mainnet status, fake metadata, or visible TODOs. If it isn't implemented, it isn't in the production UI.

---

## §H. REPORTING (every stop or phase end)

1. **Phase / status** — one line.
2. **What works** — and the command or check that proves it.
3. **What Maris must do** — exact commands/clicks, if anything.
4. **Open questions** — STOP items only.
5. **Deadline risk** — none / low / high, one sentence.

---

## §I. FINAL MANDATE

Don't optimize for feature count. Optimize for **"I want to try another combination."** A player should finish a match and immediately wonder *"what happens if I splice a Crown Chog with that weird Skull one?"* — that curiosity is the retention engine. If a feature doesn't strengthen **SPLICE → REVEAL → FIGHT → DISCOVER → SPLICE AGAIN** or satisfy a submission requirement, don't build it during the hackathon. Make **the splice, the reveal and the fight** unforgettable, then make it reliable enough that a judge cannot break it.
