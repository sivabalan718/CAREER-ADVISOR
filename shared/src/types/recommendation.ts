import { Opportunity } from './opportunity.js';

export interface SkillGapItem {
  skillName: string;
  studentProficiency: number;  // 0 - 100
  requiredProficiency: number; // 0 - 100
  gapMagnitude: number;        // required - student
  bridgingRecommendation: string;
}

export interface PathwayStep {
  stepIndex: number;
  phaseName: string;
  durationMonths: number;
  milestone: string;
  institutionsOrPlatforms?: string[];
  actionableGoal: string;
}

export interface GroundedExplanation {
  whyThis: string[];
  whyNotAlternatives: string[];
  whatWouldChangeResult: string[]; // Variables that would alter this recommendation
}

export interface RecommendationScoreBreakdown {
  interestFitScore: number;       // 0 - 100 (RIASEC Cosine Similarity)
  skillFitScore: number;          // 0 - 100
  financialFitScore: number;      // 0 - 100
  marketOutlookScore: number;     // 0 - 100
  mobilityScore: number;          // 0 - 100
  weightsApplied: Record<string, number>;
}

export interface PathwayRecommendation {
  id: string;
  studentId: string;
  opportunity: Opportunity;
  
  // Strict separation of fit and confidence
  fitScore: number;               // 0.0 to 100.0
  confidenceScore: number;        // 0.0 to 100.0 (Fit ≠ Confidence)
  
  // Financial solver outcomes
  isFinancialFeasible: boolean;   // FALSE if hard constraints violated
  financialViolations?: string[];
  paybackPeriodYears: number | null; // NULL if salary unknown, never 0

  // Parent-Student Conflict Index (PCI)
  parentStudentConflictIndex: number; // 0.0 to 1.0
  pciDimensionGaps: Record<string, number>; // Individual dimension gap breakdown

  scores: RecommendationScoreBreakdown;
  skillGaps: SkillGapItem[];
  roadmap: PathwayStep[];
  explanation: GroundedExplanation;

  evidenceProvenanceSummary: {
    verifiedDimensions: number;
    partialDimensions: number;
    externalFallbackDimensions: number;
    insufficientDimensions: number;
  };
  
  computedAt: string;
}
