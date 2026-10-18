import { describe, expect, it } from 'vitest';
import { fetchWithFallback, pool } from '../../scripts/lib/net';

const ok = (body: string) => new Response(body, { status: 200 });

describe('fetchWithFallback (mocked fetch)', () => {
  it('falls back to the next gateway on failure', async () => {
    const calls: string[] = [];
    const fetchFn = async (url: string) => {
      calls.push(url);
      return url.startsWith('https://b/') ? ok('hi') : new Response('', { status: 429 });
    };
    const bytes = await fetchWithFallback('ipfs://cid/1.json', { fetchFn, gateways: ['https://a/', 'https://b/'], baseDelay: 0 });
    expect(new TextDecoder().decode(bytes)).toBe('hi');
    expect(calls).toEqual(['https://a/cid/1.json', 'https://b/cid/1.json']);
  });
  it('retries with backoff then throws', async () => {
    let n = 0;
    const fetchFn = async () => {
      n++;
      throw new Error('offline');
    };
    await expect(fetchWithFallback('ipfs://x', { fetchFn, gateways: ['https://a/'], attempts: 3, baseDelay: 0 })).rejects.toThrow('offline');
    expect(n).toBe(3);
  });
});

describe('pool', () => {
  it('preserves order and respects the limit', async () => {
    let active = 0;
    let peak = 0;
    const out = await pool([1, 2, 3, 4, 5], 2, async (x) => {
      peak = Math.max(peak, ++active);
      await new Promise((r) => setTimeout(r, 1));
      active--;
      return x * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10]);
    expect(peak).toBeLessThanOrEqual(2);
  });
});
