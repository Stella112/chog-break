// CHOG//BREAK sponsor: one free (gasless) Recorded Splice per wallet and per IP every 48 h, under a daily cap.
// The player signs a plain message (no gas, no tokens). The relayer wallet pays the fee and the gas and calls
// ChogBreakRegistry.recordSpliceFor(player, a, b), so the PLAYER is credited as splicer / first discoverer.
// This file is the logic only (no HTTP), so it can be tested against the real contract on a local chain.
import { getAddress, isAddress, parseAbi, parseEventLogs } from 'viem';

export const CHAIN_ID = 143;
export const WINDOW_MS = 48 * 60 * 60 * 1000;
export const MAX_SKEW_MS = 10 * 60 * 1000;
const MAX_TOKEN_ID = 1969;

export const REGISTRY_ABI = parseAbi([
  'function fee() view returns (uint256)',
  'function paused() view returns (bool)',
  'function CHOG_TOKEN() view returns (address)',
  'function recordSpliceFor(address player, uint256 a, uint256 b) returns (bool first)',
  'event SpliceRecorded(address indexed splicer, address indexed payer, uint256 lo, uint256 hi, bytes32 indexed pairKey, address ownerLo, address ownerHi, uint256 fee, uint256 shareLo, uint256 shareHi, uint256 prize, uint256 burned, bool first)',
]);
const ERC20_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

/** The exact text the player signs. Must match src/chain/sponsorMessage.ts (a unit test checks they agree). */
export function sponsorMessage({ address, a, b, issuedAt }) {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return [
    'CHOG//BREAK free recording',
    `Pair: token ${lo} x token ${hi}`,
    `Wallet: ${getAddress(address)}`,
    `Chain: ${CHAIN_ID}`,
    `Issued: ${issuedAt}`,
    'Signing is free. It lets the CHOG//BREAK sponsor pay the fee and gas to record this pair for you.',
  ].join('\n');
}

export class SponsorError extends Error {
  constructor(code, status, extra = {}) {
    super(code);
    this.code = code;
    this.status = status;
    Object.assign(this, extra);
  }
}

/** In-memory claims with a JSON snapshot for restarts: { wallets: {addr: ts}, ips: {ip: ts}, days: {date: n} }. */
export function memoryStore(initial = {}) {
  const s = { wallets: {}, ips: {}, days: {}, ...initial };
  return {
    data: s,
    lastWallet: (a) => s.wallets[a] ?? 0,
    lastIp: (ip) => s.ips[ip] ?? 0,
    countDay: (d) => s.days[d] ?? 0,
    record(a, ip, now) {
      s.wallets[a] = now;
      s.ips[ip] = now;
      const d = new Date(now).toISOString().slice(0, 10);
      s.days[d] = (s.days[d] ?? 0) + 1;
      // forget anything older than the window so the file stays small
      for (const k of ['wallets', 'ips']) for (const [key, t] of Object.entries(s[k])) if (now - t > WINDOW_MS) delete s[k][key];
    },
  };
}

/**
 * @param {object} o
 * @param {import('viem').PublicClient} o.publicClient
 * @param {import('viem').WalletClient} o.walletClient  relayer wallet (has an account)
 * @param {`0x${string}`} o.registry
 * @param {number} o.dailyCap   max sponsored recordings per UTC day
 * @param {ReturnType<typeof memoryStore>} o.store
 * @param {() => number} [o.now]
 * @param {() => void} [o.persist]
 */
export function createSponsor({ publicClient, walletClient, registry, dailyCap, store, now = Date.now, persist = () => {} }) {
  const relayer = walletClient.account.address;
  const pending = new Set();
  let queue = Promise.resolve();
  const today = () => new Date(now()).toISOString().slice(0, 10);

  async function status(address, ip) {
    const t = now();
    const wallet = isAddress(address ?? '') ? getAddress(address).toLowerCase() : null;
    const nextWallet = wallet ? store.lastWallet(wallet) + WINDOW_MS : 0;
    const nextIp = store.lastIp(ip) + WINDOW_MS;
    const remainingToday = Math.max(0, dailyCap - store.countDay(today()));
    const nextAt = Math.max(nextWallet, nextIp);
    const [paused, fee, token, mon] = await Promise.all([
      publicClient.readContract({ address: registry, abi: REGISTRY_ABI, functionName: 'paused' }),
      publicClient.readContract({ address: registry, abi: REGISTRY_ABI, functionName: 'fee' }),
      publicClient.readContract({ address: registry, abi: REGISTRY_ABI, functionName: 'CHOG_TOKEN' }),
      publicClient.getBalance({ address: relayer }),
    ]);
    const chog = await publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: 'balanceOf', args: [relayer] });
    // don't offer a free recording the relayer can't pay for
    const funded = chog >= fee && mon > 0n;
    return {
      eligible: !paused && funded && remainingToday > 0 && nextAt <= t,
      funded,
      nextAt: nextAt > t ? nextAt : null,
      remainingToday,
      paused,
      fee: fee.toString(),
    };
  }

  async function relay(player, a, b) {
    const token = await publicClient.readContract({ address: registry, abi: REGISTRY_ABI, functionName: 'CHOG_TOKEN' });
    const fee = await publicClient.readContract({ address: registry, abi: REGISTRY_ABI, functionName: 'fee' });
    const [bal, allowance, mon] = await Promise.all([
      publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: 'balanceOf', args: [relayer] }),
      publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: 'allowance', args: [relayer, registry] }),
      publicClient.getBalance({ address: relayer }),
    ]);
    if (bal < fee) throw new SponsorError('SPONSOR_EMPTY', 503);
    if (mon === 0n) throw new SponsorError('SPONSOR_EMPTY', 503);
    let approveTx = null;
    if (fee > 0n && allowance < fee) {
      // exact amount, never unlimited
      const { request } = await publicClient.simulateContract({ account: walletClient.account, address: token, abi: ERC20_ABI, functionName: 'approve', args: [registry, fee] });
      approveTx = await walletClient.writeContract(request);
      const r = await publicClient.waitForTransactionReceipt({ hash: approveTx, timeout: 120_000 });
      if (r.status !== 'success') throw new SponsorError('RELAY_FAILED', 502);
    }
    const { request } = await publicClient.simulateContract({
      account: walletClient.account,
      address: registry,
      abi: REGISTRY_ABI,
      functionName: 'recordSpliceFor',
      args: [player, BigInt(a), BigInt(b)],
    });
    const txHash = await walletClient.writeContract(request);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 });
    if (receipt.status !== 'success') throw new SponsorError('RELAY_FAILED', 502);
    const [ev] = parseEventLogs({ abi: REGISTRY_ABI, logs: receipt.logs, eventName: 'SpliceRecorded' });
    if (!ev) throw new SponsorError('RELAY_FAILED', 502);
    const x = ev.args;
    return {
      txHash,
      approveTx,
      first: x.first,
      lo: Number(x.lo),
      hi: Number(x.hi),
      pairKey: x.pairKey,
      splicer: x.splicer,
      payer: x.payer,
      ownerLo: x.ownerLo,
      ownerHi: x.ownerHi,
      fee: x.fee.toString(),
      shareLo: x.shareLo.toString(),
      shareHi: x.shareHi.toString(),
      prize: x.prize.toString(),
      burned: x.burned.toString(),
    };
  }

  /** Validate a signed claim and record the pair for the player. Throws SponsorError with an HTTP status. */
  async function claim(body, ip) {
    const { address, a, b, issuedAt, signature } = body ?? {};
    if (!isAddress(address ?? '')) throw new SponsorError('BAD_REQUEST', 400);
    const ia = Number(a);
    const ib = Number(b);
    const ok = (n) => Number.isInteger(n) && n >= 1 && n <= MAX_TOKEN_ID;
    if (!ok(ia) || !ok(ib) || ia === ib) throw new SponsorError('BAD_PAIR', 400);
    const t = now();
    const issued = Date.parse(issuedAt ?? '');
    if (!Number.isFinite(issued) || Math.abs(t - issued) > MAX_SKEW_MS) throw new SponsorError('EXPIRED', 400);
    const player = getAddress(address);
    const message = sponsorMessage({ address: player, a: ia, b: ib, issuedAt });
    let valid = false;
    try {
      // publicClient.verifyMessage also supports smart-contract wallets (ERC-1271 / ERC-6492)
      valid = await publicClient.verifyMessage({ address: player, message, signature });
    } catch {
      valid = false;
    }
    if (!valid) throw new SponsorError('BAD_SIGNATURE', 401);

    const wallet = player.toLowerCase();
    if (pending.has(wallet) || pending.has(`ip:${ip}`)) throw new SponsorError('IN_PROGRESS', 429);
    const nextAt = Math.max(store.lastWallet(wallet), store.lastIp(ip)) + WINDOW_MS;
    if (nextAt > t) throw new SponsorError('RATE_LIMITED', 429, { nextAt });
    if (store.countDay(today()) >= dailyCap) throw new SponsorError('DAILY_CAP', 429);

    pending.add(wallet);
    pending.add(`ip:${ip}`);
    // one relay at a time: the relayer's nonces stay in order
    const run = queue.then(() => relay(player, ia, ib));
    queue = run.catch(() => {});
    try {
      const result = await run;
      store.record(wallet, ip, now());
      persist();
      return result;
    } catch (e) {
      if (e instanceof SponsorError) throw e;
      const msg = String(e?.shortMessage ?? e?.message ?? '').toLowerCase();
      if (msg.includes('paused')) throw new SponsorError('PAUSED', 503);
      throw new SponsorError('RELAY_FAILED', 502);
    } finally {
      pending.delete(wallet);
      pending.delete(`ip:${ip}`);
    }
  }

  return { status, claim, relayer };
}
