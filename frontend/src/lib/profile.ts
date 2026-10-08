import {
  StudentProfile,
  ParentProfile,
  EducationStage,
  AcademicStream,
  IncomeBracket,
  GeographicMobilityLimit,
  TimeToIncomeRange,
  SectorPreference,
  RiskProfile,
  StudentEvidenceLevel,
  SKILL_TAXONOMY
} from '@m63/shared';

/** Raw answers captured by the journey. Everything starts empty — nothing is invented for a fresh user. */
export interface JourneyAnswers {
  fullName: string;
  age: number | null;
  educationStage: EducationStage | '';
  classOrYear: string;
  country: string;
  region: string;
  city: string;
  stream: AcademicStream | '';
  strongSubjects: string[];
  weakSubjects: string[];
  overallPercentage: number | null;
  board: string;
  entranceExams: string[];
  subjectMarks: Record<string, number>;
  scenarioPicks: string[];
  riasec: { realistic: number; investigative: number; artistic: number; social: number; enterprising: number; conventional: number };
  skills: Array<{ name: string; level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'; evidence: StudentEvidenceLevel; proofUrl?: string }>;
  experiences: Array<{ title: string; type: 'PROJECT' | 'INTERNSHIP' | 'HACKATHON' | 'VOLUNTEERING' | 'CERTIFICATION' | 'RESEARCH'; skills: string[] }>;
  interestAreas: string[];
  dreamCareer: string;
  undecided: boolean;
  sector: StudentProfile['aspirations']['governmentVsPrivate'];
  higherStudies: StudentProfile['aspirations']['higherStudiesIntent'];
  workModel: 'ONSITE' | 'HYBRID' | 'REMOTE' | 'FLEXIBLE';
  workStyle: StudentProfile['workPreferences'];
  relocateDomestic: boolean;
  relocateInternational: boolean;
  riskTolerance: number;
  studyYearsTolerance: number;
  family: {
    relationship: ParentProfile['relationship'];
    incomeBracket: IncomeBracket | '';
    budgetTotal: number | null;
    loanWilling: boolean;
    maxLoan: number;
    scholarshipDependence: 'NONE' | 'HELPFUL' | 'CRITICAL';
    mobilityLimit: GeographicMobilityLimit;
    timeToIncome: TimeToIncomeRange;
    sectorPreference: SectorPreference;
    riskProfile: RiskProfile;
    stayNearImportance: number;
    skipped: boolean;
  };
  priorities: string[];
  guardian: { name: string; relationship: string; contact: string; consented: boolean } | null;
}

export const PRIORITY_KEYS = ['CAREER_FIT', 'JOB_OPPORTUNITY', 'FINANCIAL_FEASIBILITY', 'FAMILY_AGREEMENT', 'EARN_SOON', 'STABILITY', 'LONG_TERM_GROWTH', 'LOCATION'];

export function emptyAnswers(): JourneyAnswers {
  return {
    fullName: '', age: null, educationStage: '', classOrYear: '', country: 'India', region: '', city: '',
    stream: '', strongSubjects: [], weakSubjects: [], overallPercentage: null, board: '', entranceExams: [], subjectMarks: {},
    scenarioPicks: [], riasec: { realistic: 50, investigative: 50, artistic: 50, social: 50, enterprising: 50, conventional: 50 },
    skills: [], experiences: [], interestAreas: [], dreamCareer: '', undecided: false,
    sector: 'NEUTRAL', higherStudies: 'UNDECIDED', workModel: 'FLEXIBLE',
    workStyle: { analyticalVsCreative: 0, individualVsTeam: 0, practicalVsTheoretical: 0, structuredVsFlexible: 0, peopleVsTechnology: 0, routineVsChanging: 0, specialistVsMultidisciplinary: 0 },
    relocateDomestic: true, relocateInternational: false, riskTolerance: 0.5, studyYearsTolerance: 4,
    family: { relationship: 'MOTHER', incomeBracket: '', budgetTotal: null, loanWilling: false, maxLoan: 0, scholarshipDependence: 'HELPFUL', mobilityLimit: 'DOMESTIC_ANYWHERE', timeToIncome: '3_TO_4_YEARS', sectorPreference: 'NEUTRAL', riskProfile: 'MODERATE', stayNearImportance: 0.5, skipped: false },
    priorities: [...PRIORITY_KEYS],
    guardian: null
  };
}

/** Fresh-user invariant: no age, city, skills, scores or priorities are fabricated. */
export function createEmptyStudentProfile(): StudentProfile {
  return {
    id: `std-${Date.now()}`,
    userId: `usr-${Date.now()}`,
    age: 0,
    isMinor: false,
    educationStage: 'SCHOOL_HIGHER_SECONDARY',
    classOrYear: '',
    academicStream: 'UNDECIDED',
    location: { country: '', region: '', city: '' },
    preferredLanguage: 'English',
    academicProfile: { subjects: [], strongestSubjects: [], weakestSubjects: [], overallPercentage: 0, academicConsistency: 0 },
    aptitude: { logicalReasoning: 0, numericalReasoning: 0, verbalReasoning: 0, abstractReasoning: 0, spatialReasoning: 0, analyticalThinking: 0, problemSolving: 0, isAssessed: false },
    interests: { realistic: 0, investigative: 0, artistic: 0, social: 0, enterprising: 0, conventional: 0 },
    workPreferences: { analyticalVsCreative: 0, individualVsTeam: 0, practicalVsTheoretical: 0, structuredVsFlexible: 0, peopleVsTechnology: 0, routineVsChanging: 0, specialistVsMultidisciplinary: 0 },
    skills: [],
    experiences: [],
    aspirations: { dreamCareer: '', isUndecided: true, preferredIndustries: [], governmentVsPrivate: 'NEUTRAL', higherStudiesIntent: 'UNDECIDED', priorityRanking: [] },
    riskAndMobility: {
      willingnessToRelocateDomestic: true, willingnessToRelocateInternational: false, preferredRegions: [],
      unconventionalCareerAcceptance: 0.5, riskTolerance: 0.5, educationDurationToleranceYears: 4,
      loanWillingness: false, maxComfortableLoanAmount: 0, expectedTimeToEarningYears: 4
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

const LEVEL_TO_PROFICIENCY = { BEGINNER: 35, INTERMEDIATE: 60, ADVANCED: 85 } as const;
const TIME_YEARS: Record<TimeToIncomeRange, number> = { '1_TO_2_YEARS': 2, '3_TO_4_YEARS': 4, '5_TO_6_YEARS': 6, '7_PLUS_YEARS': 8 };

/** Scenario picks nudge the self-rated RIASEC sliders (60% sliders, 40% revealed choices). */
export function deriveRiasec(a: JourneyAnswers, scenarioDims: Record<string, string>): StudentProfile['interests'] {
  const picked: Record<string, number> = { realistic: 0, investigative: 0, artistic: 0, social: 0, enterprising: 0, conventional: 0 };
  a.scenarioPicks.forEach((id, i) => {
    const dim = scenarioDims[id];
    if (dim) picked[dim] += i === 0 ? 100 : i === 1 ? 75 : 55;
  });
  const hasPicks = a.scenarioPicks.length > 0;
  const out = { ...a.riasec };
  (Object.keys(out) as Array<keyof typeof out>).forEach(k => {
    out[k] = Math.round(hasPicks ? 0.6 * a.riasec[k] + 0.4 * Math.min(100, picked[k]) : a.riasec[k]);
  });
  return out;
}

export function buildStudentProfile(
  a: JourneyAnswers,
  userId: string,
  scenarioDims: Record<string, string>,
  aptitude: StudentProfile['aptitude'] | null,
  base?: StudentProfile | null
): StudentProfile {
  const now = new Date().toISOString();
  const age = a.age ?? 0;
  return {
    id: base?.id ?? `std-${userId}`,
    userId,
    age,
    isMinor: age > 0 && age < 18,
    educationStage: (a.educationStage || 'SCHOOL_HIGHER_SECONDARY') as EducationStage,
    classOrYear: a.classOrYear,
    academicStream: (a.stream || 'UNDECIDED') as AcademicStream,
    location: { country: a.country || 'India', region: a.region, city: a.city },
    preferredLanguage: 'English',
    academicProfile: {
      subjects: [...a.strongSubjects, ...a.weakSubjects].map(s => ({ subject: s, scorePercentage: (a.subjectMarks ?? {})[s] ?? a.overallPercentage ?? 0, trend: 'STABLE' as const, isFavorite: a.strongSubjects.includes(s) })),
      strongestSubjects: a.strongSubjects,
      weakestSubjects: a.weakSubjects,
      overallPercentage: a.overallPercentage ?? undefined,
      academicConsistency: a.overallPercentage ? Math.min(1, a.overallPercentage / 100) : 0
    },
    aptitude: aptitude ?? base?.aptitude ?? createEmptyStudentProfile().aptitude,
    interests: deriveRiasec(a, scenarioDims),
    workPreferences: a.workStyle,
    skills: a.skills.map((s, i) => {
      const tax = SKILL_TAXONOMY.find(t => t.name === s.name);
      return {
        id: `sk_${i}`,
        name: s.name,
        category: (tax?.category ?? 'TECHNICAL') as StudentProfile['skills'][number]['category'],
        proficiency: LEVEL_TO_PROFICIENCY[s.level],
        evidenceLevel: s.evidence,
        verifiedCredentialUrl: s.proofUrl || undefined
      };
    }),
    experiences: a.experiences.map((e, i) => ({ id: `ex_${i}`, title: e.title, type: e.type, description: e.title, skillsApplied: e.skills, evidenceLevel: 'CLAIMED' as const })),
    aspirations: {
      dreamCareer: a.undecided ? '' : a.dreamCareer,
      isUndecided: a.undecided || !a.dreamCareer.trim(),
      preferredIndustries: a.interestAreas,
      governmentVsPrivate: a.sector,
      higherStudiesIntent: a.higherStudies,
      workModelPreference: a.workModel,
      priorityRanking: a.priorities
    },
    riskAndMobility: {
      willingnessToRelocateDomestic: a.relocateDomestic,
      willingnessToRelocateInternational: a.relocateInternational,
      preferredRegions: a.region ? [a.region] : [],
      unconventionalCareerAcceptance: a.riskTolerance,
      riskTolerance: a.riskTolerance,
      educationDurationToleranceYears: a.studyYearsTolerance,
      loanWillingness: a.family.loanWilling,
      maxComfortableLoanAmount: a.family.maxLoan,
      expectedTimeToEarningYears: TIME_YEARS[a.family.timeToIncome]
    },
    createdAt: base?.createdAt ?? now,
    updatedAt: now
  };
}

export function buildParentProfile(a: JourneyAnswers, userId: string, studentId: string): ParentProfile | null {
  const f = a.family;
  if (f.skipped || f.budgetTotal === null) return null;
  const now = new Date().toISOString();
  return {
    id: `par-${userId}`,
    userId,
    linkedStudentId: studentId,
    relationship: f.relationship,
    financialCapacity: {
      householdIncomeBracket: (f.incomeBracket || 'PREFER_NOT_TO_SAY') as IncomeBracket,
      dependentsCount: 0,
      maximumTotalEducationBudget: f.budgetTotal,
      maxAnnualAffordableExpense: Math.round(f.budgetTotal / Math.max(1, a.studyYearsTolerance))
    },
    fundingWillingness: {
      willingnessToFundHigherEducation: true,
      educationLoanWillingness: f.loanWilling,
      maximumComfortableLoanAmount: f.loanWilling ? f.maxLoan : 0,
      scholarshipDependenceLevel: f.scholarshipDependence,
      lowCostHighRoiPreferenceWeight: f.scholarshipDependence === 'CRITICAL' ? 0.9 : 0.5
    },
    riskPreferences: {
      riskProfile: f.riskProfile,
      sectorPreference: f.sectorPreference,
      emergingCareerAcceptance: f.riskProfile === 'HIGH' ? 0.9 : f.riskProfile === 'MODERATE' ? 0.6 : 0.3,
      entrepreneurshipAcceptance: f.sectorPreference === 'STARTUP_ACCEPTED' ? 0.9 : 0.3
    },
    geographicConstraints: {
      mobilityLimit: f.mobilityLimit,
      preferredRegions: a.region ? [a.region] : [],
      importanceOfStayingNearFamily: f.stayNearImportance
    },
    expectations: { expectedTimeToIncome: f.timeToIncome, priorityRanking: a.priorities },
    nonFinancialConstraints: { caregivingDependents: false, mandatoryStableEmploymentRequired: f.riskProfile === 'CONSERVATIVE' },
    createdAt: now,
    updatedAt: now
  };
}
