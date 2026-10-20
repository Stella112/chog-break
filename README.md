# CHOG//BREAK: Mutant Arena

**Pick any two real Chog Genesis NFTs. Their real traits and artwork splice into a deterministic mutant, which you then fight in a side-view arena whose rules are mutated by the Chogs in the match.**

> The Chog NFTs are not skins. They are genetic material.

Loop: **SPLICE → REVEAL → FIGHT → DISCOVER → SPLICE AGAIN**

---

## Judge quick start (no wallet, ~60 s)

**Live: https://chog-break.vercel.app**

Open the app and press **ENTER THE LAB**, or use these links directly (append to the app URL):

| What | Link |
|---|---|
| A secret mutation (**KING BEAM**: laser eyes × crown) | `/?a=18&b=66` |
| The same pair, reversed → identical mutant | `/?a=66&b=18` |
| Straight into a fight | `/?a=18&b=66&fight=1` |
| A Radioactive × Radioactive splice (specimen-jar art) | `/?a=70&b=352` |

Controls (desktop keyboard): **A/D** move · **W** jump (press again in the air to double jump, again to recover) · **S** drop · **J** punch combo · **K** dash · **L** special (from the Eyes) · **I** close move (from the Mouth). Your first fight coaches you step by step.

Try **TRY A SECRET MUTATION** on the home screen for a random one of the 16 secret recipes.

**Holder path (optional):** press **CONNECT WALLET** (top bar) or open **MY CHOGS** (`/?view=mychogs`). The app reads which Chogs your address holds straight from the Chog Genesis contract on Monad and lists them with their genes and your experiments; **SPLICE WITH…** loads one into the Lab, which also gets a MY CHOGS tab. If your wallet is on another network, **SWITCH TO MONAD** adds or selects chain 143. Holders also get cosmetic badges (YOURS in the Lab, HOLDER SPLICE on the reveal, YOUR CHOG in the notebook, a holder line on share cards); they never change gameplay. Browsing your Chogs never asks you to sign anything.

---

## Why the Chog NFTs are essential

Remove Chog Genesis and nothing is left: every part of a match comes from the collection's real metadata.

| Role of the NFT | Where in the code |
|---|---|
| **Identity:** all 1,969 real tokens, browsable and searchable, with their real art | `public/data/chogs.json` (built from on-chain `tokenURI`s), `src/ui/CollectionBrowser.tsx` |
| **Genetics:** each of 7 trait slots is inherited from one parent; every real trait value maps to a gene | `src/core/genes.ts`, `src/core/splice.ts` |
| **Visual composition:** the mutant's art is composited from both parents' real images | `src/art/mutantRenderer.ts` |
| **Abilities:** Eyes → special, Mouth → close move, Head → defense/recovery, Body → physics, Base → affinity, Accessory → trinket, Aura → element | `src/arena/kit.ts`, `src/arena/moves.ts` |
| **Secret recipes:** 16 cross-parent trait combos (e.g. laser eyes + crown = KING BEAM) override name, art and add a perk | `src/core/recipes.ts` |
| **Arena rules:** the Backgrounds of all four parents in a match pick the modifiers (toxic floor, low gravity, meteors…) | `src/core/arenaRules.ts`, `src/arena/modifiers.ts` |

Rarity never equals strength: Tier changes no stat (enforced by tests over every gene combination).

---

## What's in this build

- **Lab:** browse/search/filter all 1,969 real Chogs (filters generated from the data), load two parents, SPLICE.
- **Reveal:** a splice-rig sequence (parent tubes, lightning, chamber), then the mutant, its name, and every inherited trait with *from #A / from #B* and the gene it gave.
- **Fight:** Phaser 3 arena vs a bot (Easy / Normal / Hard) or **local 2-player**. Smash-style damage % and knockback, 2 lives, dynamic camera, animated characters with the mutant's portrait as the head. The arena is **2.5D**: a three.js lab (stage and floating platforms as real 3D blocks, glass specimen tanks, lighting, hit flashes, fighter shadows) and **3D fighters** (lit, outlined bodies with the mutant's real portrait on a coin-shaped head) rendered under the Phaser gameplay layer, with its camera locked to the fight camera. Gameplay stays on one plane, Smash-style. `?arena=2d` (or no WebGL) uses the flat 2D arena. Every gene, all 16 recipe perks and all 10 arena modifiers have a real effect.
- **Lab Notebook:** every mutant you make, with W–L record, secret/unstable badges, Fight and Share buttons. Stored on this device.
- **Share card:** 1200×675 PNG download and a Post on X intent link (never auto-posts).
- **Sound and music:** all synthesized in code (WebAudio), with SOUND and MUSIC toggles.
- **MY CHOGS (optional, read-only):** connect a browser wallet to see the Chogs you hold, read straight from the Chog Genesis contract on Monad (`balanceOf`, then `ownerOf` via Multicall3), with their genes, your experiments with them and a SPLICE WITH… shortcut. The Lab gets a MY CHOGS tab. A wallet on another network gets a SWITCH TO MONAD button. Connecting never asks you to sign or send anything, and everything else works without a wallet.

**Recorded Splice (live on Monad):** the registry [`0xB435a54816Cb32B70F08C34fF388B9A718Ba3Db1`](https://monadscan.com/address/0xB435a54816Cb32B70F08C34fF388B9A718Ba3Db1) (source verified on Sourcify/MonadVision, exact match) records a pair for a 100 $CHOG fee. The first recorder gets permanent first-discoverer credit, and the fee is split 35% / 35% to the **current owners of the two parent tokens**, 20% to a prize-pool address and 10% sent to the dead address. The app approves exactly the fee, simulates first, and the player confirms in their own wallet. Covered by 29 Foundry tests, 5 fork tests against Monad mainnet, and browser tests against the compiled contract on a local chain. FREE EXPERIMENT stays the default and needs no wallet.

---

## Run locally

Requires Node ≥ 20.

```bash
npm ci
npm run dev          # http://localhost:5173
npm run build        # production build → dist/
```

## Tests

```bash
npm run typecheck && npm run lint && npm test   # 59 unit tests (Vitest)
npx playwright install chromium                  # once
npm run test:e2e                                 # browser tests against the production build
```

The browser suite covers the full guest flow (home → lab → splice → reveal → fight → results → notebook), deep-link determinism across browser profiles, every gene / recipe / modifier effect, bot recovery and difficulty ladder, 60 fps, low-frame-rate physics, load time (Lab interactive in ~2 s on 10 Mbit/s), failure cases (malformed data, missing art, offline), reduced motion and a 375 px layout. A headless 300-match balance simulation checks that no gene wins more than 65% of its matches (`tests/e2e/balance.spec.ts`).

---

## How it works

**Stack:** Vite + TypeScript (strict) · React 18 (screens) · Phaser 3 with Arcade Physics (arena) · viem (hashing) · Vitest + Playwright · static hosting.

```
src/core/     pure, deterministic game logic (no React, Phaser, DOM, time or Math.random; enforced by lint + test)
src/arena/    Phaser scenes, fighter, moves, modifiers, bot, headless simulator
src/art/      mutant compositor, share card
src/ui/       React screens
src/audio/    synthesized sound effects and music
scripts/      data pipeline: chain checks, manifest, trait report, sprites
```

**Determinism:** `pairKey = keccak256(abi.encode(CHOG_GENESIS, lo, hi))`, so A×B is always identical to B×A, on any device, forever. Separate seeded streams (sfc32) drive genes, names, visuals and arena rules. Ownership, time and wallets never affect the result.

**Data:** chain facts were checked against Monad mainnet (chain 143); see `docs/CHAIN_CHECK.md`. The token set (exactly IDs 1–1969) was proven with `ownerOf`; metadata and art were fetched from IPFS once and are served from this site (`public/`), so the game needs no RPC or IPFS at runtime (only the optional MY CHOGS page reads the Monad RPC). Every trait count matches the published collection (`docs/TRAIT_REPORT.md`, `docs/RECIPE_EXAMPLES.md`).

**Unstable mutants** (5% of pairs) are chosen by a fixed hash rule, not by chance.

## Security and privacy

No accounts, no secrets in the repo. The wallet connection is optional: the app asks for your address and reads ownership from Monad. The only transactions in the code are the optional Recorded Splice (once deployed): it approves exactly the fee (never an unlimited allowance), simulates first, and the user confirms each step in their own wallet. Nothing is sent anywhere else: the notebook lives in the browser's local storage. Share links only contain two token IDs.

## Known limitations

- The notebook is per device (local storage).
- The bot is a transparent state machine; there is no online multiplayer.
- Unstable is deterministic, not random.
- Best on a desktop keyboard; the Lab works on phones, the arena is keyboard-only.

## Licenses and acknowledgements

All code was written during Chogathon 2026. Chog art comes from each token's own metadata (Chog Genesis). UI art is drawn in code; all sound and music is synthesized in code. Open-source libraries: React, Phaser, viem, Vite, TypeScript, Vitest, Playwright, sharp, ESLint, Prettier. Fonts: Google Fonts (Bungee, Archivo, JetBrains Mono). NFT ownership does not grant copyright; no royalties or ownership claims are made.

## Deploy (static)

`vercel.json` is included: framework `vite`, build `npm run build`, output `dist`. No environment variables are needed.

## Data pipeline (already run; results committed)

```bash
npm run data:verify    # chain facts → docs/CHAIN_CHECK.md
npm run data:manifest  # tokenURI + metadata → public/data/chogs.json (+ chogs.min.json for the browser)
npm run data:report    # docs/TRAIT_REPORT.md
npm run data:sprites   # public/chogs/*.webp
```
