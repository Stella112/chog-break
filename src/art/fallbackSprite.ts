// §D6 fallback: a simple rounded creature tinted by skin colour, tagged "art offline". Never throws.
export function drawFallbackSprite(ctx: CanvasRenderingContext2D, size: number, tint: string) {
  const s = size;
  ctx.save();
  ctx.fillStyle = tint;
  ctx.strokeStyle = '#0b0a10';
  ctx.lineWidth = s * 0.025;
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.58, s * 0.3, s * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#0b0a10';
  for (const x of [0.4, 0.6]) {
    ctx.beginPath();
    ctx.arc(s * x, s * 0.52, s * 0.035, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = `${Math.round(s * 0.06)}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd400';
  ctx.fillText('ART OFFLINE', s * 0.5, s * 0.95);
  ctx.restore();
}

export function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
