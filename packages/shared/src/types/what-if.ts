import { PathwayRecommendation } from './recommendation.js';

export interface ScenarioModificationDelta {
  budgetDelta?: number;               // Adjust max budget (+/- INR)
  loanWillingnessOverride?: boolean;
  geographicMobilityOverride?: string;
  skillBoosts?: Record<string, number>; // Simulate gaining 30 points in Python/Math
  priorityRankingOverride?: string[];  // Change importance order
  budgetOverride?: number;             // Absolute family education budget (INR)
  maxLoanOverride?: number;            // Absolute comfortable loan ceiling (INR)
  mobilityLimitOverride?: 'SAME_CITY_ONLY' | 'WITHIN_STATE' | 'DOMESTIC_ANYWHERE' | 'INTERNATIONAL_ALLOWED';
  expectedTimeToIncomeOverride?: '1_TO_2_YEARS' | '3_TO_4_YEARS' | '5_TO_6_YEARS' | '7_PLUS_YEARS';
  riskToleranceOverride?: number;      // 0.0 – 1.0
}

export interface AdieWhatIfComparison {
  opportunityId: string;
  opportunityTitle: string;
  baselineRank: number;
  scenarioRank: number;
  baselineScore: number;
  scenarioScore: number;
  scoreDelta: number;
  baselineFeasible: boolean;
  scenarioFeasible: boolean;
  keyDrivers: string[];
}

export interface AdieWhatIfResult {
  scenarioId: string;
  appliedChanges: string[];
  baseline: import('./decision-analysis.js').DecisionAnalysisResult;
  scenario: import('./decision-analysis.js').DecisionAnalysisResult;
  comparisons: AdieWhatIfComparison[];
  topChanged: boolean;
  computedAt: string;
}

export interface WhatIfScenario {
  id: string;
  studentId: string;
  name: string;
  description?: string;
  modifications: ScenarioModificationDelta;
  createdAt: string;
}

export interface SimulationDeltaComparison {
  opportunityId: string;
  opportunityTitle: string;
  baselineFitScore: number;
  scenarioFitScore: number;
  scoreDelta: number;
  baselineFeasible: boolean;
  scenarioFeasible: boolean;
  pciDelta: number;
  keyDrivers: string[];
}

export interface WhatIfSimulationResult {
  scenarioId: string;
  baselineRecommendations: PathwayRecommendation[];
  scenarioRecommendations: PathwayRecommendation[];
  comparisons: SimulationDeltaComparison[];
  computedAt: string;
}
