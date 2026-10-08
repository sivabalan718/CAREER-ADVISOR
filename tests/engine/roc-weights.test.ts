import { describe, it, expect } from 'vitest';
import { computeRocWeights } from '../../engine/src/roc-weights.js';

describe('Rank Order Centroid (ROC) Preference Weighting', () => {
  it('calculates mathematically valid weights summing to 1.0 for 5 dimensions', () => {
    const dimensions = ['SALARY', 'STABILITY', 'LOCATION', 'WORK_LIFE', 'PRESTIGE'];
    const result = computeRocWeights(dimensions);

    expect(result.dimensions).toEqual(dimensions);
    expect(result.method).toBe('RANK_ORDER_CENTROID');

    const sum = Object.values(result.weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 4);

    // Strict monotonic decreasing verification
    const weights = dimensions.map(d => result.weights[d]);
    for (let i = 0; i < weights.length - 1; i++) {
      expect(weights[i]).toBeGreaterThan(weights[i + 1]);
    }
  });

  it('handles single dimension with weight 1.0', () => {
    const result = computeRocWeights(['SALARY']);
    expect(result.weights['SALARY']).toBe(1.0);
  });

  it('handles empty dimensions gracefully', () => {
    const result = computeRocWeights([]);
    expect(result.weights).toEqual({});
  });
});
