import { describe, expect, it } from 'vitest';
import { removeFlatBackground } from '../../scripts/lib/bgremove';

describe('removeFlatBackground', () => {
  it('clears the flat border and keeps the centre', () => {
    const w = 10;
    const h = 10;
    const px = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const inside = x >= 3 && x < 7 && y >= 3 && y < 7;
        px.set(inside ? [200, 20, 20, 255] : [240, 240, 100, 255], (y * w + x) * 4);
      }
    const { out, opaqueRatio } = removeFlatBackground(px, w, h);
    expect(out[3]).toBe(0);
    expect(out[(5 * w + 5) * 4 + 3]).toBe(255);
    expect(opaqueRatio).toBeCloseTo(0.16);
  });
});
