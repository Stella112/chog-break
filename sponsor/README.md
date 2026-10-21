# CHOG//BREAK sponsor

Pays the fee and gas for **one free Recorded Splice per wallet and per IP every 48 hours**, up to a daily cap. The player only signs a free message. The relayer calls `ChogBreakRegistry.recordSpliceFor(player, a, b)` (v2), so the player is credited as the discoverer, and the parent owners get their 35% each as usual.

- `core.mjs`: the logic, tested against the compiled contract on anvil (`tests/unit/sponsor.anvil.test.ts`).
- `server.mjs`: an HTTP wrapper on `127.0.0.1:47410`, behind Caddy (HTTPS).
- `chogbreak-sponsor.service`: a systemd unit (dynamic unprivileged user, read-only system, state in `/var/lib/chogbreak-sponsor`).

## API

- `GET /api/sponsor/status?address=0x…` → `{ eligible, nextAt, remainingToday, paused, fee }`
- `POST /api/sponsor/record` `{ address, a, b, issuedAt, signature }` → the decoded `SpliceRecorded` event. The signature is `personal_sign` over `sponsorMessage()` (wallet, pair, chain 143, issue time). It's valid for 10 minutes and can't be reused for another pair.
- Error codes:
  - `BAD_REQUEST`, `BAD_PAIR`, `EXPIRED`, `BAD_SIGNATURE`
  - `RATE_LIMITED` (with `nextAt`), `IN_PROGRESS`, `DAILY_CAP`
  - `SPONSOR_EMPTY`, `PAUSED`, `RELAY_FAILED`

## Limits and risk

The most the relayer can lose in a day is `DAILY_CAP × fee` in $CHOG plus gas: with 30 × 10 $CHOG, that's 300 $CHOG (about $0.30). The IP and wallet limits slow down farming but don't stop it; the daily cap is the real ceiling. Keep the relayer funded with only a few days' budget.

## Setup on the VPS (Maris holds the key)

1. `/etc/chogbreak-sponsor/relayer.env` (mode 600) contains `RELAYER_PRIVATE_KEY=0x…`. Maris creates it; it is never in the repo or a chat.
2. `/etc/chogbreak-sponsor/sponsor.env` contains:

   ```
   REGISTRY=0x…   # registry v2
   RPC_URL=https://rpc.monad.xyz
   PORT=47410
   DAILY_CAP=30
   ALLOWED_ORIGINS=https://chog-break.vercel.app
   ```

3. Copy this folder to `/opt/chogbreak-sponsor`, run `npm ci --omit=dev`, install the unit, then `systemctl enable --now chogbreak-sponsor`.
4. Add a Caddy site, with a backup of the Caddyfile first, `caddy validate`, then `systemctl reload caddy`:

   ```
   chogbreak-api.38-49-209-149.sslip.io {
   	reverse_proxy 127.0.0.1:47410
   }
   ```
