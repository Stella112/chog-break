# Chogathon 2026 submission: CHOG//BREAK: Mutant Arena

> Draft text for each submission field. The **Description** block is kept under the 8,000-character limit (checked by `npm run docs:check`). Replace `<APP_URL>` with the production URL after deploying.

## Project name
CHOG//BREAK: Mutant Arena

## One-line pitch
Pick two real Chog Genesis NFTs, splice their traits and art into a mutant, and fight it in an arena whose rules are mutated by the Chogs in the match.

## Description

**The Chog NFTs are not skins. They are genetic material.**

CHOG//BREAK turns the 1,969 Chog Genesis NFTs into ingredients. Pick any two real Chogs in the Lab and press SPLICE. Their real metadata decides everything that happens next.

**Splice.** Each of seven trait slots (Eyes, Head, Mouth, Body, Base, Accessory, Aura) is inherited from one parent, and every real trait value in the collection maps to a gene (most change how you fight; a few are cosmetic). Laser eyes give a charged BEAM special; a crown makes you harder to launch; a Skull base revives you once; a knife sharpens your punches; a wind aura turns your dash into a gust. The mutant's art is composited from both parents' real images, and the name is generated from its genes.

**Reveal.** A short lab-malfunction sequence (glass tubes, lightning, a chamber flash) then shows the mutant beside its two parents, with every inherited trait labelled "from #A" or "from #B" and the gene it produced. You instantly see how A + B made this.

**Fight.** Take your mutant into a Smash-style side-view arena against a bot (Easy, Normal, Hard) or a friend on the same keyboard. Damage % builds up, knockback grows, knock them off the screen. Your mutant's genes are your moveset: its special, close move, recovery, weight, speed and passives all come from the parents. The arena mutates too: the Backgrounds of all four Chogs in the match pick modifiers such as a rotating toxic floor, low gravity, slippery or bouncy floors, meteor showers, coin rain or a shrinking stage. These affect both fighters, so an NFT changes the rules rather than buying power.

**Discover.** Sixteen secret recipes hide in specific cross-parent combinations (laser eyes + crown = KING BEAM; Skull + Radioactive = NUCLEAR UNDEAD). Each one renames the mutant, changes its look and adds a perk. The Lab Notebook keeps every mutant you have made with its fight record, shows secret mutations found as "N / ???", and the results screen hints when one of your parents is half of a recipe you haven't found. With 1,937,496 possible pairs, the natural question after every fight is "what happens if I splice that one instead?"

**Rarity never equals strength.** Tier changes no stat, which is enforced by tests over every gene combination. A headless 300-match bot-vs-bot simulation checks that no gene wins more than 65% of its matches.

**Deterministic and permanent.** A pair's identity is `keccak256(abi.encode(CHOG_GENESIS, lo, hi))`. A×B is always B×A, identical on every device and for every visitor, independent of who owns the tokens. Share a link like `/?a=18&b=66` and everyone sees the same mutant.

**Built to be judged.** No wallet is needed for anything. The full collection (metadata and art) was fetched from the chain and IPFS once and is served from the site, so the game never waits on an RPC or gateway. The Lab is interactive in about 2 seconds, and the arena runs at 60 fps. The first fight teaches the controls step by step.

## What's new / novel
Two existing NFTs become genetic inputs for a playable third entity, and the same genetic material also rewrites the arena's rules. Every one of the collection's real trait values maps to a gene, and secret cross-parent recipes reward exploring pairs.

## Why Chog Genesis is essential
The NFTs supply the parents' identity and art, the mutant's genetics, its visual composition, its abilities, the secret recipes and the arena's rules. Remove Chog Genesis and the product disappears. (Code map in the README.)

## How to test (no wallet, ~60 seconds)
1. Open `<APP_URL>` and press **ENTER THE LAB**, or open `<APP_URL>/?a=18&b=66` for a secret mutation (KING BEAM).
2. Watch the reveal: each trait shows which parent it came from and what gene it gave.
3. Press **FIGHT ▸**, then **FIGHT ▸** again. Desktop keyboard: A/D move, W jump, J punch, K dash, L special, I close move. The first fight coaches you.
4. Knock the bot off the screen twice. Then try **Change #…** to swap one parent and see how the mutant and its moves change.
5. Optional: **TRY A SECRET MUTATION** on the home screen; **LOCAL 2P** on the pre-match screen.

## Tech stack
Vite + TypeScript (strict), React 18, Phaser 3 (Arcade Physics), viem (hashing), WebAudio (all sound and music synthesized in code), Vitest + Playwright, static hosting. Data pipeline in TypeScript against Monad mainnet (chain 143) and IPFS.

## Pre-existing work
None. All code was written during Chogathon 2026. Open-source libraries are listed in the README. Art comes from the Chog Genesis collection's own metadata.

## User feedback / usage
Internal playtesting only. The first playtest feedback ("I don't know how to play" and "it looks like moving static pictures") led directly to the in-fight coach, the visual controls guide and the animated character rigs.

## What's next
Holder mode (connect a wallet to see your own Chogs and splice with them), Recorded Splices on Monad with first-discoverer credit and parent-holder payouts in $CHOG, a Daily Experiment challenge, and online play.
