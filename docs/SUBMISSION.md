# Chogathon 2026 submission: CHOG//BREAK: Mutant Arena

> Draft text for each submission field. The **Description** block is kept under the 8,000-character limit (checked by `npm run docs:check`). App: https://chog-break.vercel.app · Repo: https://github.com/Stella112/chog-break

## Project name
CHOG//BREAK: Mutant Arena

## One-line pitch
Pick two real Chog Genesis NFTs, splice their traits and art into a mutant, and fight it in an arena whose rules are mutated by the Chogs in the match.

## Links
- App: https://chog-break.vercel.app (play: https://chog-break.vercel.app/play/)
- Repository: https://github.com/Stella112/chog-break
- Recorded Splice registry (Monad, source verified): https://monadscan.com/address/0x0EBe620530E604E6D05E0ffE7589c807E9e91527
- First mainnet recording: https://monadscan.com/tx/0xfa06348c2cc0b589c68dd7c1e9d7e21aa34b562cfc3a852b53abb7be0b9ac874
- Demo video (2:22): Maris adds the YouTube (unlisted) or Drive link here after uploading `video/out/chog-break-demo-web.mp4`

## Description

**The Chog NFTs are not skins. They are genetic material.**

CHOG//BREAK turns the 1,969 Chog Genesis NFTs into ingredients. Pick any two real Chogs in the Lab and press SPLICE. Their real metadata decides everything that happens next.

**Splice.** Each of seven trait slots (Eyes, Head, Mouth, Body, Base, Accessory, Aura) is inherited from one parent, and every real trait value in the collection maps to a gene (most change how you fight; a few are cosmetic). Laser eyes give a charged BEAM special; a crown makes you harder to launch; a Skull base revives you once; a knife sharpens your punches; a wind aura turns your dash into a gust. The mutant's art is composited from both parents' real images, and the name is generated from its genes.

**Reveal.** A short lab-malfunction sequence (glass tubes, lightning, a chamber flash) then shows the mutant beside its two parents, with every inherited trait labelled "from #A" or "from #B" and the gene it produced. You instantly see how A + B made this.

**Fight.** Take your mutant into a Smash-style side-view arena against a bot (Easy, Normal, Hard) or a friend on the same keyboard. Damage % builds up, knockback grows, knock them off the screen. Your mutant's genes are your moveset: its special, close move, recovery, weight, speed and passives all come from the parents. The arena mutates too: the Backgrounds of all four Chogs in the match pick modifiers such as a rotating toxic floor, low gravity, slippery or bouncy floors, meteor showers, coin rain or a shrinking stage. These affect both fighters, so an NFT changes the rules rather than buying power.

**Discover.** Sixteen secret recipes hide in specific cross-parent combinations (laser eyes + crown = KING BEAM; Skull + Radioactive = NUCLEAR UNDEAD). Each one renames the mutant, changes its look and adds a perk. The Lab Notebook keeps every mutant you have made with its fight record, shows secret mutations found as "N / ???", and the results screen hints when one of your parents is half of a recipe you haven't found. With 1,937,496 possible pairs, the natural question after every fight is "what happens if I splice that one instead?"

**Progression.** Every fight against the bot earns XP (100 for a win, +15 per KO). The mutant levels up, and so does each of its two parent Chogs, so a Chog builds a career across every mutant it parents: its level, XP, wins and fights show on the results screen, in the Notebook, in the Lab and in MY CHOGS. XP is cosmetic and never changes a stat, so fights stay fair and deterministic. It is stored on the device.

**Recorded Splice ($CHOG).** With a wallet, a player can record any experiment on Monad for a 10 $CHOG fee (registry `0x0EBe620530E604E6D05E0ffE7589c807E9e91527`, source verified). The first to record a pair is its permanent first discoverer, and every recording pays 35% of the fee to the current owner of each parent Chog, so holding a popular Chog earns $CHOG. The rest goes 20% to a prize pool and 10% to the dead address. New players get their first recording free and gasless: they sign a message and the game pays the fee and gas, and they still get the discoverer credit. The free experiment stays the default.

**Holders.** Connect a wallet (optional) to open MY CHOGS: the Chogs you hold, read straight from the contract on Monad, with the genes each one carries, your experiments with it and a one-click SPLICE WITH… The Lab gets a MY CHOGS tab. Nothing is ever signed or sent.

**Rarity never equals strength.** Tier changes no stat, which is enforced by tests over every gene combination. A headless 300-match bot-vs-bot simulation checks that no gene wins more than 65% of its matches.

**Deterministic and permanent.** A pair's identity is `keccak256(abi.encode(CHOG_GENESIS, lo, hi))`. A×B is always B×A, identical on every device and for every visitor, independent of who owns the tokens. Share a link like `/?a=18&b=66` and everyone sees the same mutant.

**Built to be judged.** No wallet is needed for anything. The full collection (metadata and art) was fetched from the chain and IPFS once and is served from the site, so the game never waits on an RPC or gateway. The Lab is interactive in about 2 seconds, and the arena runs at 60 fps. The first fight teaches the controls step by step.

## What's new / novel
Two existing NFTs become genetic inputs for a playable third entity, and the same genetic material also rewrites the arena's rules. Every one of the collection's real trait values maps to a gene, and secret cross-parent recipes reward exploring pairs.

## Why Chog Genesis is essential
The NFTs supply the parents' identity and art, the mutant's genetics, its visual composition, its abilities, the secret recipes and the arena's rules. Remove Chog Genesis and the product disappears. (Code map in the README.)

## How to test (no wallet, ~60 seconds)
1. Open https://chog-break.vercel.app and press **ENTER THE LAB** (straight into the Lab), or open https://chog-break.vercel.app/play/?a=18&b=66 for a secret mutation (KING BEAM).
2. Watch the reveal: each trait shows which parent it came from and what gene it gave.
3. Press **FIGHT ▸**, then **FIGHT ▸** again. Desktop keyboard: A/D move, W jump, J punch, K dash, L special, I close move. The first fight coaches you.
4. Knock the bot off the screen twice. Then try **Change #…** to swap one parent and see how the mutant and its moves change.
5. Optional: **TRY A SECRET MUTATION** on the home screen; **LOCAL 2P** on the pre-match screen.

## Tech stack
Vite + TypeScript (strict), React 18, Phaser 3 (Arcade Physics) with a three.js 2.5D arena, viem (wallet, hashing, Monad reads), Solidity + Foundry (Recorded Splice registry on Monad mainnet), a small Node sponsor service for the gasless first recording, WebAudio (all sound and music synthesized in code), Vitest + Playwright, Vercel static hosting. Data pipeline in TypeScript against Monad mainnet (chain 143) and IPFS.

Short form for the tech-stack field: `React, TypeScript, Phaser, three.js, viem, Solidity, Foundry, Monad`

## Pre-existing work
None. All code was written during Chogathon 2026. Open-source libraries are listed in the README. Art comes from the Chog Genesis collection's own metadata.

## User feedback / usage
Internal playtesting only. The first playtest feedback ("I don't know how to play" and "it looks like moving static pictures") led directly to the in-fight coach, the visual controls guide and the animated character rigs.

## What's next
a Daily Experiment challenge, and online play.

## Judge access instructions
No login, invite or wallet is needed. Open https://chog-break.vercel.app/play/?a=18&b=66 (a secret mutation) and press FIGHT twice; the first fight coaches the controls (desktop keyboard: A/D move, W jump, J punch, K dash, L special, I close move). Phones also work: the fight shows on-screen touch controls.

Optional wallet path: CONNECT WALLET shows the Chogs you hold (read-only, never asks to sign). If your wallet extension (Zerion or MetaMask) shows a "malicious dApp" warning for chog-break.vercel.app, that is a false positive from an automated scanner: choose "continue to the site", or open the link in a browser profile without a wallet extension. The game does not need a wallet.

## Go-to-market (optional field)
Who uses it: Chog holders and the wider Monad community, who get a reason to open their NFTs beyond holding them. How it grows: every mutant is a shareable link and a share card (same pair, same mutant everywhere), so each player invites the next. Holders have a reason to promote popular Chogs, because every Recorded Splice pays 35% of the fee to the owner of each parent Chog. Daily Experiment challenges and online play are the next retention steps.
