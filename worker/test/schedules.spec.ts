import { describe, expect, it } from 'vitest';

function summarize(values: number[]): { avg: number; max: number; min: number } {
  if (values.length === 0) return { avg: 0, max: 0, min: 0 };
  return {
    avg: values.reduce((a, b) => a + b, 0) / values.length,
    max: Math.max(...values),
    min: Math.min(...values),
  };
}

describe('worker report aggregation', () => {
  it('summarizes metric windows', () => {
    const s = summarize([10, 20, 30]);
    expect(s.avg).toBe(20);
    expect(s.max).toBe(30);
    expect(s.min).toBe(10);
  });

  it('handles empty windows', () => {
    expect(summarize([])).toEqual({ avg: 0, max: 0, min: 0 });
  });
});
