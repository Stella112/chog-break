// §D9 error copy: friendly, recoverable, never a raw stack trace.
export function walletErrorMessage(e: unknown): string {
  const err = e as { code?: number; name?: string; message?: string; shortMessage?: string };
  const msg = `${err?.shortMessage ?? ''} ${err?.message ?? ''}`.toLowerCase();
  if (err?.message === 'NO_WALLET') return 'No browser wallet found. Install one (for example MetaMask or Rabby) to see your Chogs. Everything else works without it.';
  if (err?.message === 'NO_ACCOUNT') return 'The wallet did not share an account. Try connecting again.';
  if (err?.code === 4001 || /user rejected|denied|rejected the request/.test(msg)) return 'Request cancelled. Nothing changed.';
  if (/timeout|timed out|took too long/.test(msg)) return 'Monad is taking too long to respond. Retry.';
  if (/fetch|network|http request failed|failed to fetch/.test(msg)) return 'Could not reach Monad. Check your connection and retry.';
  if (/chain|network mismatch/.test(msg)) return 'Switch to Monad to see your Chogs.';
  return 'Something went wrong talking to your wallet. Retry.';
}
