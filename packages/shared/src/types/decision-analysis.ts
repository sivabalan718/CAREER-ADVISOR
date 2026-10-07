import { Opportunity } from './opportunity.js';
import { GroundedExplanation, SkillGapItem, PathwayStep } from './recommendation.js';
import { ComputedRocWeights } from './constraints.js';

export interface ComponentFitBreakdown {
  overallFit: number; // 0.0 - 100.0
  components: {
    aptitude: number;       // 0.0 - 100.0
    interest: number;       // 0.0 - 100.0 (RIASEC Cosine Similarity)
    skills: number;         // 0.0 - 100.0
    workPreference: number; // 0.0 - 100.0
    experience: number;     // 0.0 - 100.0
    aspiration: number;     // 0.0 - 100.0
    riskMobility: number;   // 0.0 - 100.0
  };
  weightsApplied: Record<string, number>;
}

export interface MarketFitAnalysis {
  marketFitScore: number; // 0.0 - 100.0
  demandIndex: number | null;
  demandForecast: 'GROWING' | 'STABLE' | 'DECLINING' | 'UNKNOWN';
  jobVelocity: number | null;
  economicDisruption: number | null;
  mobilityScore: number | null;
  isDataAvailable: boolean;
  evidenceStatus: string;
  sourceProvenanceUrl?: string;
}

export interface FinancialFitAnalysis {
  isFeasible: boolean;
  financialFitScore: number | null; // 0.0 - 100.0, NULL when education cost evidence is unavailable
  affordabilityStatus: 'FULLY_AFFORDABLE' | 'REQUIRES_LOAN' | 'EXCEEDS_BUDGET' | 'LOAN_LIMIT_EXCEEDED' | 'COST_UNKNOWN';
  costEvidenceSource?: string;
  timeToIncome?: {
    educationYearsRequired: number;
    familyExpectedYears: number | null;
    withinExpectation: boolean | null;
  };
  educationCost: number;
  budgetLimit: number;
  fundingGap: number;
  loanExposure: number;
  maxLoanLimit: number;
  paybackPeriodYears: number | null; // NULL if salary is unverified/unknown. NEVER 0.
  violations: string[];
}

export interface FamilyAlignmentAnalysis {
  conflictIndex: number; // 0.0 - 1.0 (PCI)
  dimensionGaps: Record<string, number>;
  majorConflictAreas: string[];
  alignmentAreas: string[];
}

export interface RankedOpportunity {
  rank: number;
  opportunity: Opportunity;
  overallScore: number;     // Final decision score: 0.0 - 100.0
  confidence: number;       // Confidence score: 0.0 - 100.0 (Fit != Confidence)
  fitBreakdown: ComponentFitBreakdown;
  marketBreakdown: MarketFitAnalysis;
  financialBreakdown: FinancialFitAnalysis;
  familyAlignment: FamilyAlignmentAnalysis;
  constraintStatus: {
    passedHardConstraints: boolean;
    violations: string[];
  };
  evidenceSummary: {
    verifiedDimensions: number;
    partialDimensions: number;
    externalFallbackDimensions: number;
    insufficientDimensions: number;
  };
  objectiveScores?: Record<string, {
    label: string;
    score: number | null;   // NULL when evidence is unavailable — excluded from the composite, never zero
    weight: number;         // effective ROC weight after renormalising over available objectives
    available: boolean;
  }>;
  swot?: SWOTAnalysis;
  majorStrengths: string[];
  majorGaps: SkillGapItem[];
  roadmap: PathwayStep[];
  explanation: GroundedExplanation;
}

export interface DecisionAnalysisResult {
  analysisId: string;
  generatedAt: string;
  engineVersion: string;
  
  profileSummary: {
    studentId: string;
    educationStage: string;
    stream: string;
    isMinor: boolean;
    declaredPriorities: string[];
    topRIASECTraits: string[];
  };

  candidates: RankedOpportunity[];

  constraints: {
    hardPassedCount: number;
    hardFailedCount: number;
    totalEvaluated: number;
    activeHardRules: string[];
    userRocWeights: ComputedRocWeights;
  };

  familySummary?: {
    compositePCI: number;
    highestConflictDimension?: string;
  };

  methodology: {
    name: 'ADIE_MULTI_OBJECTIVE_V1';
    weightMethod: 'RANK_ORDER_CENTROID';
    fitAggregation: 'WEIGHTED_MULTI_DIMENSIONAL';
    constraintPolicy: 'HARD_FILTER_GATE_BEFORE_PREFERENCE';
    confidenceFormula: 'SOURCE_QUALITY_FRESHNESS_COVERAGE';
  };
}

export interface DreamPathwayEvaluation {
  targetOpportunity: Opportunity;
  isEligible: boolean;
  feasibilityScore: number; // 0 - 100
  readinessPercentage: number; // 0 - 100
  gapAnalysis: {
    skillGaps: SkillGapItem[];
    educationStageGapYears: number;
    financialShortfall: number;
    mobilityMismatches: string[];
  };
  actionableRoadmap: PathwayStep[];
  whatIfSensitivity: Array<{
    parameter: string;
    currentValue: string | number;
    targetValue: string | number;
    feasibilityImpact: number; // point change
  }>;
}

export interface SWOTItem {
  text: string;
  basis: 'STUDENT_EVIDENCE' | 'FAMILY_CONSTRAINT' | 'MARKET_EVIDENCE' | 'ENGINE_CALCULATION';
  sourceUrl?: string;
}

export interface SWOTAnalysis {
  strengths: SWOTItem[];
  weaknesses: SWOTItem[];
  opportunities: SWOTItem[];
  threats: SWOTItem[];
  /** Strategy moves pairing internal and external factors: leverage (S×O) and protect (W×T). */
  moves?: Array<{ type: 'LEVERAGE' | 'PROTECT'; text: string; from: string[] }>;
}
