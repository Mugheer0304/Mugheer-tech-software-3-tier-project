import { describe, expect, it } from 'vitest';

// Pure helpers extracted from monitoring logic for testability.
function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

function uptimePercent(samples: number[]): number {
  if (samples.length === 0) return 100;
  const up = samples.filter((v) => v >= 1).length;
  return (up / samples.length) * 100;
}

describe('monitoring metric math', () => {
  it('computes p95 latency', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(values, 95)).toBe(95);
  });

  it('handles empty series', () => {
    expect(percentile([], 95)).toBe(0);
  });

  it('computes uptime percent from samples (1=up, 0=down)', () => {
    expect(uptimePercent([1, 1, 1, 0, 1])).toBe(80);
    expect(uptimePercent([])).toBe(100);
  });
});
