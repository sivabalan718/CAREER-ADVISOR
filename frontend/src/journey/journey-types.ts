import {
  EducationStage,
  AcademicStream,
  IncomeBracket,
  GeographicMobilityLimit,
  TimeToIncomeRange,
  SectorPreference,
  RiskProfile,
} from '@m63/shared';

export type JourneyStepId =
  | 'about'
  | 'academics'
  | 'interests'
  | 'skills'
  | 'aspirations'
  | 'family'
  | 'priorities'
  | 'review';

export interface JourneyStepMeta {
  index: number;
  id: JourneyStepId;
  number: string;
  title: string;
  shortTitle: string;
  description: string;
}

export interface QuestionOption<T = string | number> {
  value: T;
  label: string;
  description?: string;
  icon?: string;
}

export interface ScenarioChoice {
  id: string;
  text: string;
  description?: string;
  dimension: string; // e.g., 'investigative', 'artistic', 'social', 'realistic', 'enterprising', 'conventional'
  weight: number;
}

export interface JourneyFormData {
  // Step 1: About You
  nickname: string;
  age: number;
  educationStage: EducationStage;
  classOrYear: string;
  country: string;
  region: string;
  city: string;
  preferredLanguage: string;

  // Step 2: Academics
  academicStream: AcademicStream;
  favoriteSubjects: string[];
  strongestSubjects: string[];
  challengingSubjects: string[];
  overallPercentage?: number;

  // Step 3: Interests & Cognitive Style (RIASEC + Cognitive Scenarios)
  scenarioChoices: Record<string, string>;
  riasecRatings: {
    realistic: number;
    investigative: number;
    artistic: number;
    social: number;
    enterprising: number;
    conventional: number;
  };
  cognitivePreferences: {
    analyticalVsCreative: number;
    individualVsTeam: number;
    practicalVsTheoretical: number;
    peopleVsTechnology: number;
  };

  // Step 4: Skills & Experience
  practicedSkills: Array<{
    name: string;
    proficiency: 'BEGINNER' | 'FAMILIAR' | 'INTERMEDIATE' | 'ADVANCED';
    hasPracticalEvidence: boolean;
  }>;
  notableProjects: string[];

  // Step 5: Aspirations & Work Preferences
  dreamCareer?: string;
  isUndecidedCareer: boolean;
  preferredIndustries: string[];
  workModelPreference: 'ONSITE' | 'HYBRID' | 'REMOTE' | 'FLEXIBLE';
  organizationPreference: 'STARTUP' | 'ESTABLISHED_CORP' | 'GOVERNMENT' | 'RESEARCH' | 'OPEN';
  successDefinition: string[];

  // Step 6: Family & Financial Context
  incomeBracket: IncomeBracket;
  maxEducationBudgetRange: number; // approximate total budget
  loanWillingness: boolean;
  maxComfortableLoanAmount: number;
  scholarshipDependence: 'NONE' | 'HELPFUL' | 'CRITICAL';
  geographicMobilityLimit: GeographicMobilityLimit;
  expectedTimeToIncome: TimeToIncomeRange;
  parentSectorPreference: SectorPreference;
  parentRiskProfile: RiskProfile;

  // Step 7: Priorities
  rankedPriorities: string[];
}
