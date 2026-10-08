export interface HardConstraintRule {
  id: string;
  name: string;
  dimension: 'BUDGET' | 'LOAN_LIMIT' | 'LOCATION_DISTANCE' | 'AGE_CONSENT' | 'EDUCATION_DURATION';
  check: (candidateValue: number | string) => boolean;
  failureReason: string;
}

export interface HardConstraintEvaluationResult {
  isFeasible: boolean;
  violations: Array<{
    dimension: string;
    limit: number | string;
    actual: number | string;
    reason: string;
  }>;
}

export interface UserRankingCriteria {
  dimension: string; // e.g. "SALARY" | "STABILITY" | "LOCATION" | "WORK_LIFE" | "PRESTIGE"
  rank: number;      // 1-based rank (1 is highest priority)
}

export interface ComputedRocWeights {
  dimensions: string[];
  weights: Record<string, number>; // Normalized sum to 1.0
  method: 'RANK_ORDER_CENTROID';
}
