// Token IDs the connected wallet holds (read from Monad), or null when no wallet is connected.
// Used only for cosmetic holder perks: badges, never gameplay.
import { createContext, useContext } from 'react';

export const OwnedContext = createContext<number[] | null>(null);

export function useOwned(): number[] | null {
  return useContext(OwnedContext);
}

/** The pair's parents this wallet holds, in lo/hi order. */
export function ownedParents(owned: number[] | null, lo: number, hi: number): number[] {
  if (!owned) return [];
  return [lo, hi].filter((id) => owned.includes(id));
}
