# Deploying the Recorded Splice registry (Maris only)

**This moves real funds (gas in MON). Only Maris runs it, with her own wallet. Agents never deploy.**

The contract is `contracts/src/ChogBreakRegistry.sol`. When someone records a splice it takes the `$CHOG` fee from them and splits it:

- 35% to the current owner of the lower token ID
- 35% to the current owner of the higher token ID
- 20% to the prize-pool address
- 10% to `0x000000000000000000000000000000000000dEaD` (sent to the dead address, not a `burn()` call)

It has no upgradeability and no way to withdraw tokens. The owner can only:
- change the fee (never above `MAX_FEE`)
- change the prize address
- pause or unpause recording

## 1. Check the code and tests yourself

```bash
cd contracts
forge test                                   # 29 unit tests (mocks)
MONAD_RPC_URL=https://rpc.monad.xyz forge test --network monad --match-contract Fork -vv   # 5 read-only fork tests vs real Monad
```

Both must say `0 failed`. The fork tests run against a local copy of Monad, so nothing is sent. They prove three things:
- `ownerOf(1)` works
- `$CHOG` has 18 decimals and moves exact amounts (no transfer fee)
- a full recorded splice against the real Chog Genesis and `$CHOG` contracts splits exactly 35/35/20/10

## 2. Make a keystore account (once)

Use a wallet that has a little MON for gas. Import it into Foundry's encrypted keystore; this asks for the key in your terminal and never stores it in a plain file:

```bash
cast wallet import maris-deployer --interactive
```

Never paste a private key or seed phrase into a file, a chat or a command line.

## 3. Choose the values

| Variable | Meaning | Suggested (your decision) |
|---|---|---|
| `CHOG_NFT_ADDRESS` | Chog Genesis | `0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763` |
| `CHOG_TOKEN_ADDRESS` | $CHOG | `0x350035555E10d9AfAF1566AaebfCeD5BA6C27777` |
| `LAB_FEE` | fee in raw units (18 decimals) | `100000000000000000000` = 100 $CHOG |
| `MAX_FEE` | hard cap, can never be raised | `10000000000000000000000` = 10,000 $CHOG |
| `PRIZE_POOL_RECIPIENT` | where the 20% goes | an address you control |
| `OWNER` | admin (fee, prize address, pause) | your address (a hardware wallet is best) |

## 4. Dry run (sends nothing)

PowerShell:

```powershell
$env:CHOG_NFT_ADDRESS="0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763"
$env:CHOG_TOKEN_ADDRESS="0x350035555E10d9AfAF1566AaebfCeD5BA6C27777"
$env:LAB_FEE="100000000000000000000"
$env:MAX_FEE="10000000000000000000000"
$env:PRIZE_POOL_RECIPIENT="<your prize address>"
$env:OWNER="<your owner address>"
cd contracts
forge script script/Deploy.s.sol --network monad --rpc-url https://rpc.monad.xyz --account maris-deployer
```

It prints:
- the chain ID (must be **143**)
- your deployer address and MON balance
- both contract addresses, and $CHOG decimals read from the chain
- the fee and max fee, raw and in $CHOG
- the prize address, the owner and the split

Then it stops with `ABORT: set CONFIRM_MAINNET_DEPLOY=YES`. **Read every line.**

## 5. Deploy

Only if every line is right:

```powershell
$env:CONFIRM_MAINNET_DEPLOY="YES"
forge script script/Deploy.s.sol --network monad --rpc-url https://rpc.monad.xyz --account maris-deployer --broadcast
```

Your keystore asks for its password and signs the transaction. Copy two things from the output:
- the line `ChogBreakRegistry deployed at 0x…`
- the transaction hash

## 6. Hand back to the Builder

Paste the **registry address** and the **transaction hash** in the chat. The Builder then:
1. puts them in `src/config/chain.ts` (`REGISTRY_ADDRESS`, with the tx hash as a comment)
2. checks on-chain that the deployed contract's `CHOG_GENESIS`, `CHOG_TOKEN`, `fee`, `MAX_FEE`, `prizeRecipient` and `owner` match what you chose

Until then the app shows no Recorded Splice anywhere.

## 7. The final check (yours)

Run one real Recorded Splice in the app (spec §F Phase 6, human checkpoint). Then paste the explorer links into PROGRESS.md and confirm three things:
- the receipt succeeded
- "FIRST DISCOVERY!" was shown
- both parent owners' $CHOG balances went up by exactly 35% of the fee each
