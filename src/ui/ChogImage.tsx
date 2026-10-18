import { useState } from 'react';
import { spriteUrl, thumbUrl } from '../data/manifest';

/** Same-origin Chog art with a code-drawn fallback when the file is missing. */
export function ChogImage({ tokenId, alt, thumb = false }: { tokenId: number; alt: string; thumb?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <div className="art-offline" role="img" aria-label={`${alt} (art offline)`}>
        <span>ART OFFLINE</span>
      </div>
    );
  return (
    <img
      src={thumb ? thumbUrl(tokenId) : spriteUrl(tokenId)}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      draggable={false}
    />
  );
}
