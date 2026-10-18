// §D6 mutant compositor. Driven only by mutant.visualRecipe (no independent randomness).
// Base parent drawn whole; the inserted parent replaces one side of a jagged seam, so both are visible.
import type { VisualRecipe } from '../core/splice';
import { SKIN_TINT } from '../config/geneInfo';
import { drawFallbackSprite, loadImage } from './fallbackSprite';
import { spriteUrl } from '../data/manifest';

const RECIPE_GLOW = '#ffd400';

function seamPath(ctx: CanvasRenderingContext2D, s: number, v: VisualRecipe, top: boolean) {
  const n = v.seamJags.length;
  ctx.beginPath();
  ctx.moveTo(0, top ? 0 : s);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * s;
    const y = v.seamY * s + v.seamJags[i]! * s * 0.045;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(s, top ? 0 : s);
  ctx.closePath();
}

function blendHex(a: string, b: string): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `rgb(${x.map((c, i) => Math.round((c + y[i]!) / 2)).join(',')})`;
}

async function layer(s: number, tokenId: number, tint: string): Promise<HTMLCanvasElement> {
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d')!;
  const img = await loadImage(spriteUrl(tokenId));
  if (img) ctx.drawImage(img, 0, 0, s, s);
  else drawFallbackSprite(ctx, s, tint);
  return c;
}

/** Draws the mutant into `canvas`. Resolves even if art is missing (fallback sprites). */
/** Specimen-jar outline: rounded top, flat base. */
function jarPath(ctx: CanvasRenderingContext2D, s: number) {
  const m = s * 0.04;
  const r = s * 0.28;
  ctx.beginPath();
  ctx.moveTo(m, s - m);
  ctx.lineTo(m, m + r);
  ctx.quadraticCurveTo(m, m, m + r, m);
  ctx.lineTo(s - m - r, m);
  ctx.quadraticCurveTo(s - m, m, s - m, m + r);
  ctx.lineTo(s - m, s - m);
  ctx.closePath();
}

/**
 * Draws the mutant into `canvas`. Resolves even if art is missing (fallback sprites).
 * `framed`: a parent kept its original background (§D6 bgRemoved:false) → clip into a specimen jar.
 */
export async function renderMutant(canvas: HTMLCanvasElement, v: VisualRecipe, size = 256, framed = false): Promise<void> {
  const s = size;
  canvas.width = canvas.height = s;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const tintFor = (id: number) => SKIN_TINT[id === v.baseParent ? v.skins[0] : v.skins[1]] ?? SKIN_TINT.none!;
  const [base, insert] = await Promise.all([
    layer(s, v.baseParent, tintFor(v.baseParent)),
    layer(s, v.insertParent, tintFor(v.insertParent)),
  ]);

  // 1. composite: base whole, insert clipped to its side of the seam
  const comp = document.createElement('canvas');
  comp.width = comp.height = s;
  const c = comp.getContext('2d')!;
  c.drawImage(base, 0, 0);
  c.save();
  seamPath(c, s, v, v.topParent === v.insertParent);
  c.clip();
  c.clearRect(0, 0, s, s);
  c.drawImage(insert, 0, 0);
  c.restore();

  // 2. glitch bands along the seam: shifted horizontal strips
  const bandsSrc = document.createElement('canvas');
  bandsSrc.width = bandsSrc.height = s;
  bandsSrc.getContext('2d')!.drawImage(comp, 0, 0);
  const intensity = v.anomaly ? 1 : 0.5 + v.glitchIntensity * 0.5;
  for (const [off, h, shift] of v.glitchBands) {
    const y = Math.round((v.seamY + off) * s);
    const hh = Math.max(1, Math.round(h * s));
    c.clearRect(0, y, s, hh);
    c.drawImage(bandsSrc, 0, y, s, hh, Math.round(shift * s * intensity * 2), y, s, hh);
  }

  if (framed) {
    c.save();
    c.globalCompositeOperation = 'destination-in';
    jarPath(c, s);
    c.fill();
    c.restore();
  }

  // 3. final: hue shift toward blended skin tint, light chromatic aberration, recipe glow
  ctx.clearRect(0, 0, s, s);
  ctx.save();
  if (v.recipeId) {
    ctx.shadowColor = RECIPE_GLOW;
    ctx.shadowBlur = s * 0.06;
  }
  ctx.filter = `hue-rotate(${v.hueShift}deg)`;
  ctx.drawImage(comp, 0, 0);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = blendHex(SKIN_TINT[v.skins[0]] ?? '#b48cff', SKIN_TINT[v.skins[1]] ?? '#b48cff');
  ctx.fillRect(0, 0, s, s);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.12;
  ctx.filter = 'sepia(1) saturate(6) hue-rotate(-50deg)';
  ctx.drawImage(comp, -2, 0);
  ctx.filter = 'sepia(1) saturate(6) hue-rotate(140deg)';
  ctx.drawImage(comp, 2, 0);
  ctx.restore();

  if (v.unstable) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = 0.22;
    const g = ctx.createLinearGradient(0, 0, s, s);
    ['#ff4fd8', '#4ff0ff', '#fff94f', '#4fff8a', '#ff4fd8'].forEach((col, i) => g.addColorStop(i / 4, col));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    ctx.restore();
  }

  if (framed) {
    ctx.save();
    jarPath(ctx, s);
    ctx.lineWidth = s * 0.02;
    ctx.strokeStyle = 'rgba(200, 240, 255, 0.7)';
    ctx.stroke();
    // glass highlight
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(s * 0.12, s * 0.16, s * 0.05, s * 0.6);
    ctx.restore();
  }
}

/** True if either parent's sprite kept its background (needs the specimen jar). */
export function needsJar(sprites: Record<string, { bgRemoved: boolean }>, v: VisualRecipe): boolean {
  return sprites[v.baseParent]?.bgRemoved === false || sprites[v.insertParent]?.bgRemoved === false;
}
