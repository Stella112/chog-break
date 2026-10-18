import { useState } from 'react';
import type { Mutant } from '../core/splice';
import type { Manifest } from '../data/manifest';
import { needsJar } from '../art/mutantRenderer';
import { deepLink, downloadShareCard, tweetUrl } from '../art/shareCard';
import { readNotebook } from '../state/notebook';

export function ShareButtons({
  mutant,
  manifest,
  compact = false,
}: {
  mutant: Mutant;
  manifest: Manifest;
  compact?: boolean;
}) {
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle');
  const url = deepLink(mutant);
  const name = (id: number) => manifest.byId.get(id)?.displayName ?? `#${id}`;

  const download = async () => {
    setState('busy');
    try {
      const entry = readNotebook()[mutant.pairKey];
      await downloadShareCard({
        mutant,
        loName: name(mutant.lo),
        hiName: name(mutant.hi),
        wins: entry?.wins ?? 0,
        losses: entry?.losses ?? 0,
        framed: needsJar(manifest.sprites, mutant.visualRecipe),
        url,
      });
      setState('idle');
    } catch {
      setState('error');
    }
  };

  return (
    <>
      <button
        className={`btn btn-ghost${compact ? ' small' : ''}`}
        onClick={download}
        disabled={state === 'busy'}
        aria-label={compact ? 'Download share card PNG' : undefined}
      >
        {state === 'busy' ? 'DRAWING…' : compact ? 'PNG' : 'DOWNLOAD PNG'}
      </button>
      <a
        className={`btn btn-ghost${compact ? ' small' : ''}`}
        href={tweetUrl(mutant, url)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={compact ? 'Post on X' : undefined}
      >
        {compact ? 'POST' : 'POST ON X'}
      </a>
      {state === 'error' && <span className="error-text">Couldn't draw the card. Try again.</span>}
    </>
  );
}
