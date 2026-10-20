// §D11 share card: 1200×675 PNG drawn in the browser. Never auto-posts.
import type { Mutant } from '../core/splice';
import { GENE_INFO } from '../config/geneInfo';
import { renderMutant } from './mutantRenderer';

export type ShareInfo = {
  mutant: Mutant;
  loName: string;
  hiName: string;
  wins: number;
  losses: number;
  framed: boolean;
  url: string;
  /** Holder perk: e.g. "HOLDER OF CHOG #1462" when the connected wallet holds a parent. */
  holder?: string;
};

const W = 1200;
const H = 675;

export function deepLink(m: Mutant, origin = location.origin) {
  return `${origin}/?a=${m.lo}&b=${m.hi}`;
}

export async function drawShareCard(info: ShareInfo): Promise<HTMLCanvasElement> {
  const { mutant: m } = info;
  try {
    await document.fonts?.ready;
  } catch {
    // fonts are optional
  }
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;

  // background: dark lab + hazard bars
  const g = ctx.createRadialGradient(W / 2, -100, 50, W / 2, 200, 900);
  g.addColorStop(0, '#241d3d');
  g.addColorStop(1, '#0b0a10');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (let x = -40; x < W + 40; x += 40) {
    ctx.fillStyle = '#ffd400';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 20, 0);
    ctx.lineTo(x + 6, 14);
    ctx.lineTo(x - 14, 14);
    ctx.fill();
  }

  // mutant art
  const art = document.createElement('canvas');
  await renderMutant(art, m.visualRecipe, 420, info.framed);
  ctx.fillStyle = '#15131d';
  ctx.fillRect(60, 90, 460, 460);
  ctx.strokeStyle = '#2e2a3d';
  ctx.lineWidth = 4;
  ctx.strokeRect(60, 90, 460, 460);
  ctx.drawImage(art, 80, 110, 420, 420);
  if (m.unstable) {
    ctx.save();
    ctx.translate(420, 150);
    ctx.rotate(-0.2);
    ctx.strokeStyle = '#8aff4f';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 5;
    ctx.fillRect(-90, -28, 180, 56);
    ctx.strokeRect(-90, -28, 180, 56);
    ctx.fillStyle = '#8aff4f';
    ctx.font = '34px Bungee, Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('UNSTABLE', 0, 12);
    ctx.restore();
  }
  ctx.fillStyle = '#a59fb8';
  ctx.font = '20px "JetBrains Mono", monospace';
  ctx.fillText(m.experimentLabel, 80, 585);
  if (info.holder) {
    ctx.font = 'bold 18px "JetBrains Mono", monospace';
    const tw = ctx.measureText(info.holder).width;
    ctx.fillStyle = '#4ff0ff';
    ctx.fillRect(72, 100, tw + 24, 32);
    ctx.fillStyle = '#000';
    ctx.fillText(info.holder, 84, 122);
  }

  // text column
  const x0 = 570;
  let y = 120;
  if (m.recipe) {
    ctx.fillStyle = '#ffd400';
    ctx.fillRect(x0, y - 34, 420, 46);
    ctx.fillStyle = '#000';
    ctx.font = '22px "JetBrains Mono", monospace';
    ctx.fillText('SECRET MUTATION', x0 + 14, y - 3);
    y += 40;
  }
  ctx.fillStyle = '#f1eef7';
  ctx.font = `${m.name.length > 14 ? 56 : 68}px Bungee, Impact, sans-serif`;
  ctx.fillText(m.name, x0, y + 40);
  y += 90;
  ctx.fillStyle = '#4ff0ff';
  ctx.font = '24px "JetBrains Mono", monospace';
  ctx.fillText(info.loName, x0, y);
  ctx.fillStyle = '#ffd400';
  ctx.fillText('  ×  ', x0 + ctx.measureText(info.loName).width, y);
  ctx.fillStyle = '#ff4fd8';
  ctx.fillText(info.hiName, x0 + ctx.measureText(`${info.loName}  ×  `).width, y);
  y += 50;

  const genes: [string, string][] = [
    ['L', m.special],
    ['I', m.close],
    ['HEAD', m.head],
    ['BODY', m.physics],
  ];
  if (m.affinity !== 'NORMAL') genes.push(['BASE', m.affinity]);
  if (m.element !== 'NONE' && m.element !== 'GLOW') genes.push(['AURA', m.element]);
  if (m.trinket !== 'NONE' && m.trinket !== 'CHARM') genes.push(['TRINKET', m.trinket]);
  for (const [slot, gene] of genes.slice(0, 6)) {
    ctx.fillStyle = '#a59fb8';
    ctx.font = '20px "JetBrains Mono", monospace';
    ctx.fillText(slot, x0, y);
    ctx.fillStyle = '#ffd400';
    ctx.font = 'bold 24px "JetBrains Mono", monospace';
    ctx.fillText(GENE_INFO[gene]?.label ?? gene, x0 + 110, y);
    y += 38;
  }
  y += 10;
  ctx.fillStyle = '#f1eef7';
  ctx.font = '26px "JetBrains Mono", monospace';
  ctx.fillText(`RECORD  W ${info.wins} – L ${info.losses}`, x0, y);

  // footer
  ctx.fillStyle = '#f1eef7';
  ctx.font = '44px Bungee, Impact, sans-serif';
  ctx.fillText('CHOG', 60, H - 34);
  const cw = ctx.measureText('CHOG').width;
  ctx.fillStyle = '#ffd400';
  ctx.fillText('//', 60 + cw, H - 34);
  ctx.fillStyle = '#f1eef7';
  ctx.fillText('BREAK', 60 + cw + ctx.measureText('//').width, H - 34);
  ctx.fillStyle = '#a59fb8';
  ctx.font = '20px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';
  ctx.fillText(info.url.replace(/^https?:\/\//, ''), W - 60, H - 40);
  ctx.textAlign = 'left';
  return c;
}

export async function downloadShareCard(info: ShareInfo) {
  const c = await drawShareCard(info);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
  if (!blob) throw new Error('PNG export failed');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `chogbreak-${info.mutant.lo}x${info.mutant.hi}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function tweetUrl(m: Mutant, url: string) {
  const text = `I spliced two Chogs and got ${m.recipe ? `the secret mutation ${m.name}` : m.name}. Pick two Chogs. Splice them. Then fight it.`;
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}
