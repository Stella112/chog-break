# CHOG//BREAK: Mutant Arena

**Pick two real Chog Genesis NFTs. Splice their real traits and artwork into a deterministic mutant. Fight it in an arena whose rules are mutated by the Chogs in the match.**

> Full judge README (why the NFTs are essential, architecture, quick start links) lands in Phase 7. See `docs/MASTER_SPEC.md` and `PROGRESS.md`.

## Run locally

Requires Node ≥ 20.

```bash
npm ci
npm run dev        # http://localhost:5173
```

Checks:

```bash
npm run typecheck && npm run lint && npm test   # unit tests (Vitest)
npx playwright install chromium                  # once
npm run test:e2e                                 # browser tests against the production build
```

## Deploy to Vercel (Maris)

The app is a static Vite build; all Chog data and art are served from `public/` (no IPFS or RPC needed at runtime).

1. Push this repo to GitHub.
2. In Vercel: **Add New → Project → Import** the repo. Vercel reads `vercel.json` (framework `vite`, build `npm run build`, output `dist`). No environment variables are needed for the guest game.
3. Deploy, open the URL and check: home loads → ENTER THE LAB → splice → FIGHT.
4. Send the Builder the production URL so the share-image tags (`og:image`) can be switched to an absolute URL.

## Data pipeline (already run; results committed)

```bash
npm run data:verify    # chain facts → docs/CHAIN_CHECK.md
npm run data:manifest  # tokenURI + metadata → public/data/chogs.json
npm run data:report    # docs/TRAIT_REPORT.md
npm run data:sprites   # public/chogs/*.webp
```

## Licenses and art

All code was written during Chogathon 2026. Chog art comes from each token's own metadata (Chog Genesis). UI art is drawn in code; all sound is synthesized in code (WebAudio). Fonts: Google Fonts (Bungee, Archivo, JetBrains Mono).
