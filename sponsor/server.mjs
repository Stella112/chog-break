// HTTP wrapper for the sponsor (sponsor/core.mjs). Runs on the VPS behind Caddy (HTTPS), bound to 127.0.0.1.
// Env (see sponsor/README.md):
//   RELAYER_PRIVATE_KEY  (secret: /etc/chogbreak-sponsor/relayer.env, written by Maris; never in the repo)
//   REGISTRY             ChogBreakRegistry v2 address
//   RPC_URL              default https://rpc.monad.xyz
//   PORT                 default 47410
//   DAILY_CAP            sponsored recordings per UTC day, default 30
//   ALLOWED_ORIGINS      comma-separated, default https://chog-break.vercel.app
//   STATE_DIRECTORY      set by systemd (StateDirectory=); claims are snapshotted there
import { createServer } from 'node:http';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createPublicClient, createWalletClient, defineChain, getAddress, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { CHAIN_ID, createSponsor, memoryStore, SponsorError } from './core.mjs';

const env = process.env;
const key = env.RELAYER_PRIVATE_KEY;
if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) {
  console.error('RELAYER_PRIVATE_KEY missing or malformed (expected 0x + 64 hex)');
  process.exit(1);
}
if (!env.REGISTRY) {
  console.error('REGISTRY missing');
  process.exit(1);
}
const rpc = env.RPC_URL ?? 'https://rpc.monad.xyz';
const chain = defineChain({ id: CHAIN_ID, name: 'Monad', nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 }, rpcUrls: { default: { http: [rpc] } } });
const account = privateKeyToAccount(key);
const publicClient = createPublicClient({ chain, transport: http(rpc, { retryCount: 2, timeout: 30_000 }) });
const walletClient = createWalletClient({ chain, account, transport: http(rpc, { retryCount: 1, timeout: 30_000 }) });

const stateFile = join(env.STATE_DIRECTORY ?? '.', 'claims.json');
const store = memoryStore(existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : {});
const persist = () => {
  writeFileSync(`${stateFile}.tmp`, JSON.stringify(store.data));
  renameSync(`${stateFile}.tmp`, stateFile);
};

const sponsor = createSponsor({
  publicClient,
  walletClient,
  registry: getAddress(env.REGISTRY),
  dailyCap: Number(env.DAILY_CAP ?? 30),
  store,
  persist,
});

const allowed = new Set((env.ALLOWED_ORIGINS ?? 'https://chog-break.vercel.app').split(',').map((s) => s.trim()).filter(Boolean));
const port = Number(env.PORT ?? 47410);

/** Client IP: Caddy (on this machine) puts it first in X-Forwarded-For; anything else uses the socket. */
function clientIp(req) {
  const sock = req.socket.remoteAddress ?? '';
  const fromProxy = sock === '127.0.0.1' || sock === '::1' || sock === '::ffff:127.0.0.1';
  const xff = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim();
  return fromProxy && xff ? xff : sock;
}

function send(res, status, body, origin) {
  const headers = { 'content-type': 'application/json', 'cache-control': 'no-store', vary: 'Origin' };
  if (origin && allowed.has(origin)) {
    headers['access-control-allow-origin'] = origin;
    headers['access-control-allow-methods'] = 'GET, POST, OPTIONS';
    headers['access-control-allow-headers'] = 'content-type';
  }
  res.writeHead(status, headers);
  res.end(body === null ? '' : JSON.stringify(body));
}

createServer(async (req, res) => {
  const origin = req.headers.origin;
  const url = new URL(req.url ?? '/', 'http://localhost');
  try {
    if (req.method === 'OPTIONS') return send(res, 204, null, origin);
    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true, relayer: sponsor.relayer }, origin);
    if (req.method === 'GET' && url.pathname === '/api/sponsor/status') {
      return send(res, 200, await sponsor.status(url.searchParams.get('address'), clientIp(req)), origin);
    }
    if (req.method === 'POST' && url.pathname === '/api/sponsor/record') {
      if (origin && !allowed.has(origin)) return send(res, 403, { error: 'FORBIDDEN_ORIGIN' }, origin);
      let raw = '';
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 4096) return send(res, 413, { error: 'TOO_LARGE' }, origin);
      }
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        return send(res, 400, { error: 'BAD_REQUEST' }, origin);
      }
      const result = await sponsor.claim(body, clientIp(req));
      console.log(`sponsored ${result.lo}x${result.hi} for ${result.splicer} tx ${result.txHash} first=${result.first}`);
      return send(res, 200, result, origin);
    }
    return send(res, 404, { error: 'NOT_FOUND' }, origin);
  } catch (e) {
    if (e instanceof SponsorError) return send(res, e.status, { error: e.code, nextAt: e.nextAt ?? null }, origin);
    console.error('unexpected', e?.shortMessage ?? e?.message);
    return send(res, 500, { error: 'INTERNAL' }, origin);
  }
}).listen(port, '127.0.0.1', () => console.log(`chogbreak-sponsor on 127.0.0.1:${port}, relayer ${sponsor.relayer}`));
