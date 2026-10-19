// Wallet + holder state for the UI. The wallet never blocks guest features.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Address } from 'viem';
import { CHAIN_ID } from '../config/chain';
import { connectWallet, injected, publicClient, switchToMonad, watchWallet } from '../chain/client';
import { walletErrorMessage } from '../chain/errors';
import { cacheOwned, cachedOwned, clearOwned, findOwnedChogs, type OwnershipReader, type ScanProgress } from '../chain/ownership';

export type OwnedState =
  | { status: 'idle' }
  | { status: 'scanning'; progress: ScanProgress | null }
  | { status: 'done'; ids: number[] }
  | { status: 'error'; message: string };

export type WalletState = {
  available: boolean;
  address: Address | null;
  chainId: number | null;
  onMonad: boolean;
  connecting: boolean;
  error: string | null;
  owned: OwnedState;
  connect: () => Promise<void>;
  switchChain: () => Promise<void>;
  rescan: () => void;
};

export function useWallet(tokenIds: readonly number[] | null): WalletState {
  const [address, setAddress] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [owned, setOwned] = useState<OwnedState>({ status: 'idle' });
  const scanId = useRef(0);
  const onMonad = chainId === CHAIN_ID;

  useEffect(
    () =>
      watchWallet(
        (a) => {
          setAddress(a);
          setOwned({ status: 'idle' });
        },
        (id) => setChainId(id),
      ),
    [],
  );

  const scan = useCallback(
    (addr: Address, force = false) => {
      if (!tokenIds) return;
      const cached = force ? null : cachedOwned(addr);
      if (cached) return setOwned({ status: 'done', ids: cached });
      const id = ++scanId.current;
      setOwned({ status: 'scanning', progress: null });
      findOwnedChogs(publicClient as unknown as OwnershipReader, addr, tokenIds, (progress) => {
        if (id === scanId.current) setOwned({ status: 'scanning', progress });
      }).then(
        (ids) => {
          if (id !== scanId.current) return;
          cacheOwned(addr, ids);
          setOwned({ status: 'done', ids });
        },
        (e) => {
          // clear retry state so RETRY starts fresh (§D9)
          if (id === scanId.current) setOwned({ status: 'error', message: walletErrorMessage(e) });
        },
      );
    },
    [tokenIds],
  );

  // Ownership is read from Monad itself, so it only needs the address; the wallet's chain matters for later writes.
  useEffect(() => {
    if (address && owned.status === 'idle') scan(address);
  }, [address, owned.status, scan]);

  const connect = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      const r = await connectWallet();
      setAddress(r.address);
      setChainId(r.chainId);
    } catch (e) {
      setError(walletErrorMessage(e));
    } finally {
      setConnecting(false);
    }
  }, []);

  const switchChain = useCallback(async () => {
    setError(null);
    try {
      await switchToMonad();
      setChainId(CHAIN_ID);
    } catch (e) {
      setError(walletErrorMessage(e));
    }
  }, []);

  const rescan = useCallback(() => {
    if (!address) return;
    clearOwned(address);
    scan(address, true);
  }, [address, scan]);

  return { available: !!injected(), address, chainId, onMonad, connecting, error, owned, connect, switchChain, rescan };
}
