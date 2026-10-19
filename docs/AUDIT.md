# Requirements audit (Builder, 2026-10-19)

Every requirement in `docs/MASTER_SPEC.md` was checked against the code, the tests and the running app (dev server, desktop and 375 px).

## Result in one line
**The P0 game and the P1 game features are done and tested. The open items are deployment (Maris), a real-wallet check (Maris), and the Reviewer-owned contract work (Recorded Splice, payouts), which has not started.**

## What was run
| Check | Result |
|---|---|
| `npm run build` | passes (31.8 s) |
| `npm run typecheck`, `npm run lint` | clean |
| `npm test` (Vitest) | 66 / 66 |
| `npx playwright test` (production build) | 39 / 40 on the first run. The balance sim failed (CHAOS ORB 72%) and was fixed in this audit (see below); 1 test is the opt-in screenshot capture, which is skipped |
| `npm run docs:check` | description 3,282 / 8,000 chars, no forbidden claims |

## Fixed during the audit
1. **CHAOS ORB over the balance limit** (72.4% win rate, n = 58; limit 65%). It now does 6 damage instead of 7 and bounces 3 times instead of 4 → 58.6%. The 300-match sim passes.
2. **Reveal layout broken on phones**: a later desktop CSS rule overrode the phone rule, so at ≤ 820 px the rig was squeezed into a thin column with the recipe banner on top of it. It now stacks. The 375 px e2e test checks that the info sits below the rig.
3. **Demo script** said "no wallet segment". It now has a read-only MY CHOGS shot, and the pick step is now "click a Chog".
4. **README** had no holder path. Added.
(Earlier today: Lab search matched only exact numbers and names; a click on a Chog didn't load it. Both fixed with tests.)

## §G1 P0 Definition of Done
| Item | Status | Evidence |
|---|---|---|
| production site loads | ⏳ **not deployed** | Vercel deploy is Maris's step (deferred to last by her) |
| all 1,969 Chogs browsable · filters work | ✅ | `lab.spec` filters-from-manifest; `manifest.test` counts |
| two real Chogs selectable | ✅ | `lab.spec` one-click picking + guest flow |
| same pair → same mutant · reversed pair → same mutant | ✅ | `core.test` 1,000 pairs; `lab.spec` deep link in 2 browser contexts |
| mutant art contains both parents | ✅ | `mutantRenderer.ts`; v2 seam test in `core.test` |
| real traits shown with source parent | ✅ | reveal table "from #A / from #B" |
| a secret recipe works | ✅ | `lab.spec` secret mutation; recipe perk e2e |
| reveal looks intentional | ✅ | rig sequence, SKIP, reduced-motion crossfade (`critical.spec`) |
| FIGHT opens · controls work · punch/dash | ✅ | `arena.spec`, `genes*.spec`, `p1.spec` (real key events) |
| bot works on all levels | ✅ | `bot.spec` ladder (Hard > Easy, Normal > Easy); recovery ≥ 9/10 |
| damage, knockback, lives, match end, results, rematch | ✅ | `arena.spec` full match + rematch ×10; `arena-rules.test` |
| notebook works and survives refresh | ✅ | `critical.spec`, `notebook.test` (blocked/corrupt storage) |
| changing a parent changes the mutant | ✅ | CHANGE flow checked in the browser; distinct names/genes per pair |
| no wallet required anywhere | ✅ | `wallet.spec` "no wallet installed" + every guest test |
| no console-breaking error · production build succeeds | ✅ | `critical.spec` error tracking; build passes |

**§G1 cannot be signed off until it is re-run on the live URL.**

## §G2 P1 Definition of Done
| Item | Status |
|---|---|
| wallet connects · chain enforcement (Switch to Monad, add chain) | ✅ mock-wallet e2e; ⏳ real wallet (Maris) |
| owned Chogs detected accurately | ✅ e2e uses the real on-chain owner of token 1; ⏳ Maris's wallet |
| holder can splice their own Chog | ✅ SPLICE WITH… + Lab MY CHOGS tab |
| local 2P works · share card exports | ✅ `p1.spec` |
| all contract tests pass · deployed address · Recorded Splice · discovery · payouts | ❌ **not started**: the registry contract is Reviewer-owned (`contracts/` does not exist yet). Deploying it moves real funds (STOP 5). The UI says nothing about payouts or recording |

## Phase checklists (§F)
- **Phase 0:** chain check, manifest (1,969), trait report and sprites done. ✅
- **Phase 1:** every real value mapped, order independence, pairKey vectors, power budget, recipes ≥ 1 real pair, core purity test. ✅ The power scores live in `genes.ts` (`powerOf`) rather than a separate `budget.ts`; the behaviour is the same.
- **Phase 2:** guest flow, deep links, 375 px, art fallback, trait sources. ✅
- **Phase 3:** full match, rematch ×10, lives once per KO, bot recovery, fps logged. FUN GATE passed ("I'd press rematch", recorded in PROGRESS). ✅
- **Phase 4:** every gene verified by e2e. Modifiers checked for telegraph and effect. Balance sim passes after the CHAOS ORB fix. Recipes order-independent. ✅
- **Phase 5:** polish, a11y, OG/favicon, and the critical flow on the production build. ✅ Live-URL run ⏳ (deploy).
- **Phase 6:** wallet + MY CHOGS ✅, share card ✅, local 2P ✅, P1 recipes ✅, P1 modifiers ✅, Recorded Splice ❌ (needs the contract).
- **Phase 7:** README, SUBMISSION and DEMO_SCRIPT written; fresh clone builds. ✅ Live-URL checklist ⏳.

## Honesty / no-placeholder (§G3, §G3a)
No "coming soon", TODOs, lorem ipsum, fake owners, tx hashes or earnings in the UI. No claims of on-chain records, payouts, burns, secure randomness or online play. `docs:check` enforces this for README and SUBMISSION. ✅

## Reviewer track (not Builder work, listed for completeness)
`contracts/`, `tests/review/`, `docs/REVIEW.md`, `docs/SECURITY.md` and `docs/DEPLOY.md` do not exist. The $CHOG `burn()` and fee-on-transfer checks are still under "Needs human verification".

## Open items, in order
1. **Maris:** try MY CHOGS with a real wallet.
2. **Approved 2026-10-19:** 2.5D arena (three.js). It must keep every test above green, with the 2D arena as the fallback.
3. **Maris:** Vercel deploy → Builder re-runs §G1 on the live URL.
4. Recorded Splice: only if the Reviewer's registry exists and Maris deploys it; otherwise ship without it (§F Phase 6).
