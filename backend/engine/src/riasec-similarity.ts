import { RIASECScores } from '@m63/shared';

/**
 * Computes Cosine Similarity between Student RIASEC and Opportunity RIASEC vectors.
 * Holland Hexagon dimensions: Realistic, Investigative, Artistic, Social, Enterprising, Conventional.
 * 
 * Cosine Similarity: (A · B) / (||A|| * ||B||)
 * Normalized to score between 0.0 and 100.0.
 */
export function computeRiasecCosineSimilarity(
  student: RIASECScores,
  opportunity: RIASECScores
): number {
  const sVector = [
    student.realistic,
    student.investigative,
    student.artistic,
    student.social,
    student.enterprising,
    student.conventional
  ];

  const oVector = [
    opportunity.realistic,
    opportunity.investigative,
    opportunity.artistic,
    opportunity.social,
    opportunity.enterprising,
    opportunity.conventional
  ];

  let dotProduct = 0;
  let sMagnitudeSq = 0;
  let oMagnitudeSq = 0;

  for (let i = 0; i < 6; i++) {
    dotProduct += sVector[i] * oVector[i];
    sMagnitudeSq += sVector[i] * sVector[i];
    oMagnitudeSq += oVector[i] * oVector[i];
  }

  const sMagnitude = Math.sqrt(sMagnitudeSq);
  const oMagnitude = Math.sqrt(oMagnitudeSq);

  if (sMagnitude === 0 || oMagnitude === 0) {
    return 50.0; // Neutral baseline when orientation is completely unstated
  }

  const similarity = dotProduct / (sMagnitude * oMagnitude);
  // Bound strictly between -1.0 and 1.0, map [-1, 1] -> [0, 100]
  const clampedSimilarity = Math.max(-1.0, Math.min(1.0, similarity));
  const normalizedScore = ((clampedSimilarity + 1) / 2) * 100;

  return Number(normalizedScore.toFixed(2));
}
