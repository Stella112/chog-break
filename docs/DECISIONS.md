# DECISIONS

## 2026-10-18 — Phase 0

- **Repo location:** `C:\Chogathon\chog-break` (the sibling `chog-hearth/` is an unrelated pre-existing project; untouched).
- **Pinned versions (checked with `npm view`):** react/react-dom 18.3.1, phaser 3.90.0 (latest 3.x; spec fixes Phaser 3 — 4.x exists but is out of stack), viem 2.57.7, vite 6.4.4 + @vitejs/plugin-react 4.7.0, vitest 3.2.7, typescript 5.9.3, eslint 9.39.5, typescript-eslint 8.71.2, prettier 3.9.10, tsx 4.23.15, sharp 0.35.5, @playwright/test 1.64.1.
- **No virtualization library:** the collection grid will use a small hand-rolled windowed grid to avoid an extra dependency (§B minimal deps).
- **Single tsconfig, `noEmit`:** `typecheck` = `tsc -p tsconfig.json`; Vite does the emit.
- **Core purity enforced twice:** ESLint restrictions on `src/core/**` and `tests/unit/core-purity.test.ts`.
- **Minted-set proof via `ownerOf`, not logs:** the public RPC rejects `eth_getLogs` ranges above ~100 blocks at block ~114.3M (see CHAIN_CHECK.md), so scanning `Transfer` from genesis is impractical. `ownerOf` over 0..2100 via Multicall3: exactly 1..1969 succeed. Written to `public/data/valid-token-ids.json`.
- **IPFS gateway order:** filebase first. pinata, ipfs.io and dweb.link returned HTTP 429 under bulk fetching on 2026-10-18; filebase returned 200. Still marked UNVERIFIED (a third-party service).
- **$CHOG is an EIP-1167 minimal proxy** (45-byte runtime) → implementation `0x7f64ccfeb3e3afd7691ea0ef404e947786cefae8`. The implementation bytecode contains the `burn(uint256)` and `burnFrom(address,uint256)` selectors (heuristic scan only, verified source not read). Per spec the registry keeps sending 10% to the dead address; switching to `burn()` is a Reviewer proposal + STOP 5 for Maris.
