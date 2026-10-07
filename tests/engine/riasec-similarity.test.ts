import { describe, it, expect } from 'vitest';
import { computeRiasecCosineSimilarity } from '../../packages/engine/src/riasec-similarity.js';
import { RIASECScores } from '../../packages/shared/src/types/student.js';

describe('RIASEC Holland Interest Matching (Cosine Similarity)', () => {
  it('yields 100% fit for identical RIASEC interest vectors', () => {
    const student: RIASECScores = {
      realistic: 80,
      investigative: 90,
      artistic: 40,
      social: 20,
      enterprising: 30,
      conventional: 10
    };
    const score = computeRiasecCosineSimilarity(student, student);
    expect(score).toBe(100.0);
  });

  it('yields 50% for completely orthogonal interest orientations', () => {
    const student: RIASECScores = {
      realistic: 100,
      investigative: 0,
      artistic: 0,
      social: 0,
      enterprising: 0,
      conventional: 0
    };
    const opportunity: RIASECScores = {
      realistic: 0,
      investigative: 0,
      artistic: 100,
      social: 0,
      enterprising: 0,
      conventional: 0
    };
    const score = computeRiasecCosineSimilarity(student, opportunity);
    expect(score).toBe(50.0);
  });

  it('produces reasonable alignment for correlated technical roles', () => {
    const student: RIASECScores = {
      realistic: 70,
      investigative: 85,
      artistic: 30,
      social: 25,
      enterprising: 40,
      conventional: 50
    };
    const dataScientist: RIASECScores = {
      realistic: 50,
      investigative: 95,
      artistic: 20,
      social: 15,
      enterprising: 35,
      conventional: 60
    };
    const score = computeRiasecCosineSimilarity(student, dataScientist);
    expect(score).toBeGreaterThan(90.0);
  });
});
