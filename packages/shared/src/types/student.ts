import { GeographicScope, StudentEvidenceLevel } from './evidence.js';

export type EducationStage = 
  | 'SCHOOL_SECONDARY'          // Classes 8-10
  | 'SCHOOL_HIGHER_SECONDARY'   // Classes 11-12
  | 'COLLEGE_UNDERGRAD'         // Bachelors
  | 'COLLEGE_POSTGRAD';         // Masters / Professional

export type AcademicStream =
  | 'SCIENCE_PCM'
  | 'SCIENCE_PCB'
  | 'SCIENCE_PCMB'
  | 'COMMERCE'
  | 'ARTS_HUMANITIES'
  | 'VOCATIONAL'
  | 'ENGINEERING_TECH'
  | 'BUSINESS_MGMT'
  | 'MEDICINE_HEALTH'
  | 'UNDECIDED';

export interface SubjectPerformance {
  subject: string;
  scorePercentage: number;
  grade?: string;
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
  isFavorite: boolean;
}

export interface AcademicProfile {
  subjects: SubjectPerformance[];
  strongestSubjects: string[];
  weakestSubjects: string[];
  overallPercentage?: number;
  academicConsistency: number; // 0.0 (erratic) to 1.0 (highly consistent)
}

export interface AptitudeScores {
  logicalReasoning: number;      // 0 - 100
  numericalReasoning: number;    // 0 - 100
  verbalReasoning: number;       // 0 - 100
  abstractReasoning: number;     // 0 - 100
  spatialReasoning: number;      // 0 - 100
  analyticalThinking: number;    // 0 - 100
  problemSolving: number;        // 0 - 100
  isAssessed: boolean;
  assessmentDate?: string;
  /** 0-1: how much the measurement can be trusted (precision, quality flags, marks cross-check). */
  reliability?: number;
  /** Per-dimension 80% range [low, high] shown to the student. */
  ranges?: Record<string, [number, number]>;
}

export interface RIASECScores {
  realistic: number;      // 0 - 100
  investigative: number;  // 0 - 100
  artistic: number;       // 0 - 100
  social: number;         // 0 - 100
  enterprising: number;   // 0 - 100
  conventional: number;   // 0 - 100
}

export interface WorkPreferences {
  analyticalVsCreative: number;       // -1.0 (purely analytical) to +1.0 (purely creative)
  individualVsTeam: number;           // -1.0 (solo) to +1.0 (collaborative team)
  practicalVsTheoretical: number;     // -1.0 (hands-on applied) to +1.0 (abstract theory)
  structuredVsFlexible: number;       // -1.0 (rigid hierarchy) to +1.0 (open/flexible)
  peopleVsTechnology: number;         // -1.0 (deep tech) to +1.0 (interpersonal)
  routineVsChanging: number;          // -1.0 (predictable routine) to +1.0 (dynamic change)
  specialistVsMultidisciplinary: number; // -1.0 (deep specialist) to +1.0 (polymath)
}

export interface SkillItem {
  id: string;
  name: string;
  category: 'TECHNICAL' | 'COGNITIVE' | 'COMMUNICATION' | 'CREATIVE' | 'LEADERSHIP';
  proficiency: number; // 0 - 100
  evidenceLevel: StudentEvidenceLevel;
  evidenceRecordId?: string;
  verifiedCredentialUrl?: string;
}

export interface StudentExperience {
  id: string;
  title: string;
  type: 'PROJECT' | 'INTERNSHIP' | 'HACKATHON' | 'VOLUNTEERING' | 'CERTIFICATION' | 'RESEARCH' | 'FREELANCING';
  organization?: string;
  description: string;
  startDate?: string;
  endDate?: string;
  skillsApplied: string[];
  evidenceLevel: StudentEvidenceLevel;
}

export interface StudentAspirations {
  dreamCareer?: string;
  isUndecided: boolean; // Explicitly supports "I don't know what I want"
  preferredIndustries: string[];
  governmentVsPrivate: 'GOVERNMENT_ONLY' | 'PREFER_GOVERNMENT' | 'NEUTRAL' | 'PREFER_PRIVATE' | 'STARTUP_ENTREPRENEURSHIP';
  higherStudiesIntent: 'NONE_EARN_FIRST' | 'IMMEDIATE_MASTERS' | 'WORK_THEN_MASTERS' | 'DOCTORAL_RESEARCH' | 'UNDECIDED';
  workModelPreference?: 'ONSITE' | 'HYBRID' | 'REMOTE' | 'FLEXIBLE';
  priorityRanking: string[]; // Ordered list of priorities for Rank Order Centroid (ROC) weighting
}

export interface RiskAndMobility {
  willingnessToRelocateDomestic: boolean;
  willingnessToRelocateInternational: boolean;
  preferredRegions: string[];
  unconventionalCareerAcceptance: number; // 0.0 to 1.0
  riskTolerance: number;                  // 0.0 (extreme risk-averse) to 1.0 (high risk)
  educationDurationToleranceYears: number; // Max years willing to study before earning
  loanWillingness: boolean;
  maxComfortableLoanAmount?: number;
  expectedTimeToEarningYears: number;
}

export interface StudentProfile {
  id: string;
  userId: string;
  age: number;
  isMinor: boolean; // age < 18
  educationStage: EducationStage;
  classOrYear: string;
  academicStream: AcademicStream;
  location: GeographicScope;
  preferredLanguage: string;
  academicProfile: AcademicProfile;
  aptitude: AptitudeScores;
  interests: RIASECScores;
  workPreferences: WorkPreferences;
  skills: SkillItem[];
  experiences: StudentExperience[];
  aspirations: StudentAspirations;
  riskAndMobility: RiskAndMobility;
  createdAt: string;
  updatedAt: string;
}
