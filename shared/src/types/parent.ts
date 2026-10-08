export type IncomeBracket =
  | 'BELOW_3_LAKH'
  | 'INR_3_TO_6_LAKH'
  | 'INR_6_TO_12_LAKH'
  | 'INR_12_TO_25_LAKH'
  | 'ABOVE_25_LAKH'
  | 'PREFER_NOT_TO_SAY';

export type RiskProfile = 'CONSERVATIVE' | 'MODERATE' | 'HIGH';

export type SectorPreference = 
  | 'GOVERNMENT_ONLY' 
  | 'PREFER_GOVERNMENT' 
  | 'STABLE_PRIVATE' 
  | 'NEUTRAL' 
  | 'STARTUP_ACCEPTED';

export type GeographicMobilityLimit = 
  | 'SAME_CITY_ONLY'
  | 'WITHIN_STATE'
  | 'DOMESTIC_ANYWHERE'
  | 'INTERNATIONAL_ALLOWED';

export type TimeToIncomeRange = '1_TO_2_YEARS' | '3_TO_4_YEARS' | '5_TO_6_YEARS' | '7_PLUS_YEARS';

export interface ParentFinancialCapacity {
  householdIncomeBracket: IncomeBracket;
  dependentsCount: number;
  currentAnnualEducationExpenses?: number;
  maximumTotalEducationBudget: number;       // HARD financial constraint limit
  maxAnnualAffordableExpense: number;
  savingsAllocatedForEducation?: number;
}

export interface ParentFundingWillingness {
  willingnessToFundHigherEducation: boolean;
  educationLoanWillingness: boolean;
  maximumComfortableLoanAmount: number;     // HARD loan ceiling
  scholarshipDependenceLevel: 'NONE' | 'HELPFUL' | 'CRITICAL';
  lowCostHighRoiPreferenceWeight: number;    // 0.0 to 1.0
}

export interface ParentRiskPreferences {
  riskProfile: RiskProfile;
  sectorPreference: SectorPreference;
  emergingCareerAcceptance: number;          // 0.0 (only traditional) to 1.0 (open to new fields)
  entrepreneurshipAcceptance: number;        // 0.0 (forbid) to 1.0 (support)
}

export interface ParentGeographicConstraints {
  mobilityLimit: GeographicMobilityLimit;
  preferredRegions: string[];
  maxDistanceKmFromHome?: number;
  importanceOfStayingNearFamily: number;     // 0.0 to 1.0
}

export interface ParentExpectations {
  minimumExpectedAnnualIncome?: number;
  expectedTimeToIncome: TimeToIncomeRange;
  priorityRanking: string[];                // Ranked priorities for conflict calculation
}

export interface ParentNonFinancialConstraints {
  familyResponsibilitiesDescription?: string;
  caregivingDependents: boolean;
  relocationRestrictions?: string;
  mandatoryStableEmploymentRequired: boolean;
}

export interface ParentProfile {
  id: string;
  userId: string;
  linkedStudentId: string;
  relationship: 'FATHER' | 'MOTHER' | 'LEGAL_GUARDIAN' | 'OTHER';
  financialCapacity: ParentFinancialCapacity;
  fundingWillingness: ParentFundingWillingness;
  riskPreferences: ParentRiskPreferences;
  geographicConstraints: ParentGeographicConstraints;
  expectations: ParentExpectations;
  nonFinancialConstraints: ParentNonFinancialConstraints;
  createdAt: string;
  updatedAt: string;
}
