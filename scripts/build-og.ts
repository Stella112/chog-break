// Builds public/og.png (1200×630) from two real Chog sprites + a code-drawn wordmark (no third-party art).
import sharp from 'sharp';

const W = 1200;
const H = 630;
const [A, B] = [18, 66]; // KING BEAM example pair (docs/RECIPE_EXAMPLES.md)

const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <pattern id="hz" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
      <rect width="20" height="40" fill="#ffd400"/><rect x="20" width="20" height="40" fill="#000"/>
    </pattern>
    <radialGradient id="g" cx="50%" cy="0%" r="90%"><stop offset="0" stop-color="#241d3d"/><stop offset="1" stop-color="#0b0a10"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <rect y="0" width="${W}" height="18" fill="url(#hz)"/>
  <rect y="${H - 18}" width="${W}" height="18" fill="url(#hz)"/>
  <text x="${W / 2}" y="140" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="120" fill="#f1eef7" stroke="#000" stroke-width="6">CHOG<tspan fill="#ffd400">//</tspan>BREAK</text>
  <text x="${W / 2}" y="560" text-anchor="middle" font-family="Consolas, monospace" font-size="34" fill="#f1eef7">Pick two Chogs. Splice them. Then fight it.</text>
  <text x="${W / 2}" y="368" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="110" fill="#ffd400" stroke="#000" stroke-width="5">×</text>
</svg>`);

const sprite = (id: number) => sharp(`public/chogs/${id}.webp`).resize(300, 300).png().toBuffer();
const [sa, sb] = await Promise.all([sprite(A), sprite(B)]);
await sharp(bg)
  .composite([
    { input: sa, left: 200, top: 180 },
    { input: sb, left: W - 500, top: 180 },
  ])
  .png({ compressionLevel: 9 })
  .toFile('public/og.png');
console.log('wrote public/og.png');
