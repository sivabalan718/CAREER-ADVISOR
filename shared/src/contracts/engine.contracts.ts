import { StudentProfile, RIASECScores, AptitudeScores } from '../types/student.js';
import { ParentProfile } from '../types/parent.js';
import { Opportunity } from '../types/opportunity.js';
import { EvidenceRecord, ValueWithEvidence } from '../types/evidence.js';
import { HardConstraintEvaluationResult, ComputedRocWeights } from '../types/constraints.js';
import { 
  PathwayRecommendation, 
  GroundedExplanation, 
  RecommendationScoreBreakdown, 
  SkillGapItem 
} from '../types/recommendation.js';
import { WhatIfScenario, WhatIfSimulationResult } from '../types/what-if.js';
import { 
  AssessmentQuestion, 
  AssessmentResponse, 
  AdaptiveAssessmentSession, 
  AssessmentResult 
} from '../types/assessment.js';
import { HyperLocalSTEAMOpportunity } from '../types/hyperlocal.js';

export interface IStudentIntelligenceEngine {
  evaluateAptitudeProfile(rawScores: Partial<AptitudeScores>): AptitudeScores;
  calculateInterestProfile(riasecResponses: number[]): RIASECScores;
  assessSkillConfidence(student: StudentProfile): number;
}

export interface IFamilyIntelligenceEngine {
  extractFinancialConstraints(parent: ParentProfile): {
    maxTotalBudget: number;
    maxComfortableLoan: number;
    maxAnnualExpense: number;
  };
  computeGeographicBoundaryKm(parent: ParentProfile): number | null;
}

export interface IAssessmentEngine {
  initializeSession(studentId: string, category: string): AdaptiveAssessmentSession;
  selectNextAdaptiveQuestion(session: AdaptiveAssessmentSession): AssessmentQuestion | null;
  submitResponse(session: AdaptiveAssessmentSession, response: AssessmentResponse): AdaptiveAssessmentSession;
  finalizeSession(session: AdaptiveAssessmentSession): AssessmentResult;
}

export interface IEvidenceEngine {
  validateRecord(record: EvidenceRecord): boolean;
  evaluateFreshness(retrievedAt: string, maxDaysThreshold: number): { isFresh: boolean; ageDays: number; penaltyFactor: number };
  resolveValueWithFallback<T>(field: string, rawRecord: EvidenceRecord | null, fallbackUrl?: string): ValueWithEvidence<T>;
}

export interface IOpportunityDiscoveryEngine {
  discoverByTaxonomy(taxonomyCode: string): Promise<Opportunity[]>;
  discoverByStudentSkills(skills: string[]): Promise<Opportunity[]>;
  discoverHyperLocalSTEAM(student: StudentProfile): Promise<HyperLocalSTEAMOpportunity[]>;
}

export interface IFinancialConstraintSolver {
  evaluateFeasibility(
    opportunity: Opportunity,
    parent: ParentProfile | null,
    student: StudentProfile
  ): {
    isFeasible: boolean;
    violations: string[];
    educationCost: number;
    maxBudget: number;
    loanRequired: number;
    maxLoan: number;
    paybackPeriodYears: number | null; // NULL if salary unknown, NEVER 0
  };
}

export interface IParentStudentConflictIndexCalculator {
  calculatePCI(student: StudentProfile, parent: ParentProfile): {
    compositePCI: number; // 0.0 to 1.0
    dimensionGaps: Record<string, number>;
    highConflictDimensions: string[];
  };
}

export interface IMatchingEngine {
  computeRiasecSimilarity(studentRiasec: RIASECScores, opportunityRiasec: RIASECScores): number; // 0 - 100
  computeSkillFit(studentSkills: StudentProfile['skills'], requiredSkills: Opportunity['requiredSkills']): {
    score: number;
    gaps: SkillGapItem[];
  };
  computeRocWeights(rankedPriorities: string[]): ComputedRocWeights;
}

export interface IOptimizationEngine {
  rankOpportunities(
    student: StudentProfile,
    parent: ParentProfile | null,
    candidates: Opportunity[],
    userWeights: ComputedRocWeights
  ): PathwayRecommendation[];
}

export interface IConfidenceEngine {
  calculateConfidence(
    opportunity: Opportunity,
    evidenceRecords: EvidenceRecord[]
  ): number; // 0.0 to 100.0 (strictly separate from Fit score)
}

export interface IWhatIfEngine {
  simulateScenario(
    baselineStudent: StudentProfile,
    baselineParent: ParentProfile | null,
    scenario: WhatIfScenario,
    opportunities: Opportunity[]
  ): WhatIfSimulationResult;
}

export interface IExplainabilityEngine {
  generateExplanation(
    student: StudentProfile,
    parent: ParentProfile | null,
    opportunity: Opportunity,
    scores: RecommendationScoreBreakdown,
    hardConstraints: HardConstraintEvaluationResult,
    pciGaps: Record<string, number>
  ): GroundedExplanation;
}
