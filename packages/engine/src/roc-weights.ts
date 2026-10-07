import { ComputedRocWeights } from '@m63/shared';

/**
 * Computes dimension weights using the Rank Order Centroid (ROC) method.
 * Given K ranked dimensions from rank 1 (highest) to rank K:
 * w_r = (1 / K) * sum_{i=r}^K (1 / i)
 * 
 * Guarantees:
 * 1. sum(w_r) == 1.0
 * 2. w_1 > w_2 > ... > w_K > 0
 */
export function computeRocWeights(rankedDimensions: string[]): ComputedRocWeights {
  const K = rankedDimensions.length;
  if (K === 0) {
    return {
      dimensions: [],
      weights: {},
      method: 'RANK_ORDER_CENTROID'
    };
  }

  const weights: Record<string, number> = {};
  let totalSum = 0;

  for (let r = 1; r <= K; r++) {
    let harmonicSum = 0;
    for (let i = r; i <= K; i++) {
      harmonicSum += 1 / i;
    }
    const weight = harmonicSum / K;
    const dimensionName = rankedDimensions[r - 1];
    weights[dimensionName] = weight;
    totalSum += weight;
  }

  // Normalize to guarantee exact sum = 1.0 against floating point discrepancies
  for (const dim of rankedDimensions) {
    weights[dim] = Number((weights[dim] / totalSum).toFixed(6));
  }

  return {
    dimensions: rankedDimensions,
    weights,
    method: 'RANK_ORDER_CENTROID'
  };
}
