// Flood-fill background removal from the four corners (§D6). Pure function over RGBA bytes.
export function removeFlatBackground(
  rgba: Uint8Array,
  width: number,
  height: number,
  tolerance = 32,
): { out: Uint8Array; opaqueRatio: number } {
  const out = new Uint8Array(rgba);
  const seen = new Uint8Array(width * height);
  const corners: [number, number][] = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  for (const [x, y] of corners) {
    const i = y * width + x;
    const ref = [rgba[i * 4]!, rgba[i * 4 + 1]!, rgba[i * 4 + 2]!] as const;
    const stack = [i];
    while (stack.length) {
      const p = stack.pop()!;
      if (seen[p]) continue;
      const o = p * 4;
      const d =
        Math.abs(rgba[o]! - ref[0]) + Math.abs(rgba[o + 1]! - ref[1]) + Math.abs(rgba[o + 2]! - ref[2]);
      if (d > tolerance * 3) continue;
      seen[p] = 1;
      out[o + 3] = 0;
      const px = p % width;
      const py = (p - px) / width;
      if (px > 0) stack.push(p - 1);
      if (px < width - 1) stack.push(p + 1);
      if (py > 0) stack.push(p - width);
      if (py < height - 1) stack.push(p + width);
    }
  }
  let opaque = 0;
  for (let p = 0; p < width * height; p++) if (out[p * 4 + 3]! > 0) opaque++;
  return { out, opaqueRatio: opaque / (width * height) };
}
