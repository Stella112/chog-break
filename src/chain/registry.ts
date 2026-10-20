// §D9 Recorded Splice flow against ChogBreakRegistry (contracts/src/ChogBreakRegistry.sol).
// check chain → read fee, $CHOG balance and allowance → approve EXACTLY the fee if needed → simulate →
// the user confirms in their wallet → wait for the receipt, require success → decode events.
import { parseAbi, parseEventLogs, type Address, type Hash, type TransactionReceipt } from 'viem';
import { CHAIN_ID, CHOG_TOKEN } from '../config/chain';

export const REGISTRY_ABI = parseAbi([
  'function fee() view returns (uint256)',
  'function MAX_FEE() view returns (uint256)',
  'function CHOG_GENESIS() view returns (address)',
  'function CHOG_TOKEN() view returns (address)',
  'function prizeRecipient() view returns (address)',
  'function owner() view returns (address)',
  'function paused() view returns (bool)',
  'function pairKeyOf(uint256 a, uint256 b) view returns (bytes32)',
  'function firstDiscoverer(bytes32) view returns (address)',
  'function firstDiscoveryTime(bytes32) view returns (uint64)',
  'function pairSpliceCount(bytes32) view returns (uint256)',
  'function tokenUsageCount(uint256) view returns (uint256)',
  'function tokenEarned(uint256) view returns (uint256)',
  'function recordSplice(uint256 a, uint256 b) returns (bool first)',
  'event PairDiscovered(bytes32 indexed pairKey, uint256 indexed lo, uint256 indexed hi, address discoverer)',
  'event SpliceRecorded(address indexed splicer, uint256 lo, uint256 hi, bytes32 indexed pairKey, address ownerLo, address ownerHi, uint256 fee, uint256 shareLo, uint256 shareHi, uint256 prize, uint256 burned, bool first)',
  'error SameToken()',
  'error FeeTooHigh(uint256 fee, uint256 maxFee)',
  'error ZeroAddress()',
]);

export const ERC20_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
]);

/** The subset of a viem public client the flow needs (lets tests pass a fake). */
export type RegistryReader = {
  readContract(args: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
  }): Promise<unknown>;
  simulateContract(args: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args: readonly unknown[];
    account: Address;
  }): Promise<{ request: unknown }>;
  waitForTransactionReceipt(args: { hash: Hash; timeout?: number }): Promise<TransactionReceipt>;
  getBalance(args: { address: Address }): Promise<bigint>;
};

/** The subset of a viem wallet client the flow needs. */
export type RegistryWriter = {
  getChainId(): Promise<number>;
  writeContract(request: unknown): Promise<Hash>;
};

export type RecordQuote = { fee: bigint; balance: bigint; allowance: bigint; decimals: number; mon: bigint };

export type RecordStep = 'checking' | 'approve' | 'approving' | 'record' | 'recording' | 'done';

export type RecordResult = {
  txHash: Hash;
  approveTx: Hash | null;
  first: boolean;
  lo: number;
  hi: number;
  pairKey: Hash;
  ownerLo: Address;
  ownerHi: Address;
  fee: bigint;
  shareLo: bigint;
  shareHi: bigint;
  prize: bigint;
  burned: bigint;
};

export type RecordErrorCode =
  | 'NOT_DEPLOYED'
  | 'WRONG_CHAIN'
  | 'INSUFFICIENT_CHOG'
  | 'INSUFFICIENT_MON'
  | 'PAUSED'
  | 'REJECTED'
  | 'REVERTED'
  | 'SLOW'
  | 'NETWORK';

export class RecordError extends Error {
  constructor(
    readonly code: RecordErrorCode,
    readonly detail: { need?: bigint; have?: bigint; decimals?: number } = {},
  ) {
    super(code);
  }
}

export async function readQuote(read: RegistryReader, registry: Address, user: Address): Promise<RecordQuote> {
  const [fee, balance, allowance, decimals, mon] = await Promise.all([
    read.readContract({ address: registry, abi: REGISTRY_ABI, functionName: 'fee' }) as Promise<bigint>,
    read.readContract({ address: CHOG_TOKEN, abi: ERC20_ABI, functionName: 'balanceOf', args: [user] }) as Promise<bigint>,
    read.readContract({
      address: CHOG_TOKEN,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [user, registry],
    }) as Promise<bigint>,
    read.readContract({ address: CHOG_TOKEN, abi: ERC20_ABI, functionName: 'decimals' }) as Promise<number>,
    read.getBalance({ address: user }),
  ]);
  return { fee, balance, allowance, decimals: Number(decimals), mon };
}

function classify(e: unknown): RecordError {
  if (e instanceof RecordError) return e;
  const err = e as { code?: number; message?: string; shortMessage?: string; name?: string };
  const msg = `${err?.name ?? ''} ${err?.shortMessage ?? ''} ${err?.message ?? ''}`.toLowerCase();
  if (err?.code === 4001 || /user rejected|denied|rejected the request/.test(msg)) return new RecordError('REJECTED');
  if (/enforcedpause|paused/.test(msg)) return new RecordError('PAUSED');
  if (/insufficient funds|gas required exceeds/.test(msg)) return new RecordError('INSUFFICIENT_MON');
  if (/timeout|timed out|took too long/.test(msg)) return new RecordError('SLOW');
  if (/revert|execution reverted|contractfunctionexecutionerror/.test(msg)) return new RecordError('REVERTED');
  return new RecordError('NETWORK');
}

async function confirmed(read: RegistryReader, hash: Hash): Promise<TransactionReceipt> {
  const r = await read.waitForTransactionReceipt({ hash, timeout: 120_000 });
  if (r.status !== 'success') throw new RecordError('REVERTED');
  return r;
}

/** Runs the whole Recorded Splice. Each wallet prompt is preceded by an onStep call the UI can show. */
export async function recordSplice(
  read: RegistryReader,
  wallet: RegistryWriter,
  registry: Address,
  user: Address,
  a: number,
  b: number,
  onStep: (s: RecordStep) => void = () => {},
): Promise<RecordResult> {
  try {
    onStep('checking');
    if ((await wallet.getChainId()) !== CHAIN_ID) throw new RecordError('WRONG_CHAIN');
    const q = await readQuote(read, registry, user);
    if (q.balance < q.fee) {
      throw new RecordError('INSUFFICIENT_CHOG', { need: q.fee, have: q.balance, decimals: q.decimals });
    }
    if (q.mon === 0n) throw new RecordError('INSUFFICIENT_MON');

    let approveTx: Hash | null = null;
    if (q.fee > 0n && q.allowance < q.fee) {
      onStep('approve');
      // Exact amount, never unlimited (§D9).
      const sim = await read.simulateContract({
        address: CHOG_TOKEN,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [registry, q.fee],
        account: user,
      });
      onStep('approving');
      approveTx = await wallet.writeContract(sim.request);
      await confirmed(read, approveTx);
    }

    onStep('record');
    const sim = await read.simulateContract({
      address: registry,
      abi: REGISTRY_ABI,
      functionName: 'recordSplice',
      args: [BigInt(a), BigInt(b)],
      account: user,
    });
    onStep('recording');
    const txHash = await wallet.writeContract(sim.request);
    const receipt = await confirmed(read, txHash);

    const [ev] = parseEventLogs({ abi: REGISTRY_ABI, logs: receipt.logs, eventName: 'SpliceRecorded' });
    if (!ev) throw new RecordError('REVERTED');
    const x = ev.args;
    onStep('done');
    return {
      txHash,
      approveTx,
      first: x.first,
      lo: Number(x.lo),
      hi: Number(x.hi),
      pairKey: x.pairKey,
      ownerLo: x.ownerLo,
      ownerHi: x.ownerHi,
      fee: x.fee,
      shareLo: x.shareLo,
      shareHi: x.shareHi,
      prize: x.prize,
      burned: x.burned,
    };
  } catch (e) {
    throw classify(e);
  }
}

export type PairRecord = { discoverer: Address | null; discoveredAt: number | null; count: number };

export async function readPairRecord(read: RegistryReader, registry: Address, a: number, b: number): Promise<PairRecord> {
  const key = (await read.readContract({
    address: registry,
    abi: REGISTRY_ABI,
    functionName: 'pairKeyOf',
    args: [BigInt(a), BigInt(b)],
  })) as Hash;
  const [d, t, c] = await Promise.all([
    read.readContract({ address: registry, abi: REGISTRY_ABI, functionName: 'firstDiscoverer', args: [key] }) as Promise<Address>,
    read.readContract({ address: registry, abi: REGISTRY_ABI, functionName: 'firstDiscoveryTime', args: [key] }) as Promise<bigint>,
    read.readContract({ address: registry, abi: REGISTRY_ABI, functionName: 'pairSpliceCount', args: [key] }) as Promise<bigint>,
  ]);
  const none = /^0x0{40}$/i.test(d);
  return { discoverer: none ? null : d, discoveredAt: none ? null : Number(t), count: Number(c) };
}

export async function readTokenStats(
  read: RegistryReader,
  registry: Address,
  id: number,
): Promise<{ uses: number; earned: bigint }> {
  const [u, e] = await Promise.all([
    read.readContract({ address: registry, abi: REGISTRY_ABI, functionName: 'tokenUsageCount', args: [BigInt(id)] }) as Promise<bigint>,
    read.readContract({ address: registry, abi: REGISTRY_ABI, functionName: 'tokenEarned', args: [BigInt(id)] }) as Promise<bigint>,
  ]);
  return { uses: Number(u), earned: e };
}

/** "123.4567" with up to 4 decimals, for display. */
export function formatChog(raw: bigint, decimals: number): string {
  const unit = 10n ** BigInt(decimals);
  const whole = raw / unit;
  const frac = ((raw % unit) * 10_000n) / unit;
  const f = frac.toString().padStart(4, '0').replace(/0+$/, '');
  return f ? `${whole}.${f}` : whole.toString();
}

/** §D9 error copy. */
export function recordErrorMessage(e: RecordError): string {
  switch (e.code) {
    case 'NOT_DEPLOYED':
      return 'Recorded Splice is not available yet.';
    case 'WRONG_CHAIN':
      return 'Switch to Monad to record a splice.';
    case 'INSUFFICIENT_CHOG': {
      const d = e.detail.decimals ?? 18;
      return `You need ${formatChog(e.detail.need ?? 0n, d)} $CHOG and have ${formatChog(e.detail.have ?? 0n, d)}.`;
    }
    case 'INSUFFICIENT_MON':
      return 'You need a little MON for gas.';
    case 'PAUSED':
      return 'Recording is paused right now. Free experiments still work.';
    case 'REJECTED':
      return 'Experiment cancelled. Nothing was recorded.';
    case 'SLOW':
      return 'Monad is taking too long to respond. Retry.';
    case 'REVERTED':
      return 'The transaction failed on-chain. Nothing was recorded.';
    default:
      return 'Could not reach Monad. Check your connection and retry.';
  }
}
