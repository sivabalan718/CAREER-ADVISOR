import { describe, it, expect } from 'vitest';
import { ParentStudentConflictIndexCalculator } from '../../backend/engine/src/conflict-index.js';
import { StudentProfile } from '../../backend/shared/src/types/student.js';
import { ParentProfile } from '../../backend/shared/src/types/parent.js';

describe('Parent-Student Conflict Index (PCI) Calculator', () => {
  const calculator = new ParentStudentConflictIndexCalculator();

  const baseStudent: StudentProfile = {
    id: 'stud_001',
    userId: 'usr_001',
    age: 17,
    isMinor: true,
    educationStage: 'SCHOOL_HIGHER_SECONDARY',
    classOrYear: '11th',
    academicStream: 'SCIENCE_PCM',
    location: { country: 'India' },
    preferredLanguage: 'en',
    academicProfile: { subjects: [], strongestSubjects: [], weakestSubjects: [], academicConsistency: 0.8 },
    aptitude: { logicalReasoning: 75, numericalReasoning: 80, verbalReasoning: 70, abstractReasoning: 70, spatialReasoning: 75, analyticalThinking: 80, problemSolving: 75, isAssessed: true },
    interests: { realistic: 50, investigative: 70, artistic: 30, social: 40, enterprising: 60, conventional: 50 },
    workPreferences: { analyticalVsCreative: 0, individualVsTeam: 0, practicalVsTheoretical: 0, structuredVsFlexible: 0, peopleVsTechnology: 0, routineVsChanging: 0, specialistVsMultidisciplinary: 0 },
    skills: [],
    experiences: [],
    aspirations: { isUndecided: false, preferredIndustries: [], governmentVsPrivate: 'STARTUP_ENTREPRENEURSHIP', higherStudiesIntent: 'NONE_EARN_FIRST', priorityRanking: [] },
    riskAndMobility: {
      willingnessToRelocateDomestic: true,
      willingnessToRelocateInternational: true, // High mobility
      preferredRegions: [],
      unconventionalCareerAcceptance: 0.9,
      riskTolerance: 0.9, // High risk
      educationDurationToleranceYears: 3,
      loanWillingness: true,
      expectedTimeToEarningYears: 3
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const conservativeParent: ParentProfile = {
    id: 'par_001',
    userId: 'usr_par_001',
    linkedStudentId: 'stud_001',
    relationship: 'FATHER',
    annualIncomeRange: 'INR_6_TO_12_LAKH',
    dependentsCount: 2,
    financialCapacity: {
      householdIncomeBracket: 'INR_6_TO_12_LAKH',
      dependentsCount: 2,
      maximumTotalEducationBudget: 400000,
      maxAnnualAffordableExpense: 100000
    },
    fundingWillingness: {
      willingnessToFundHigherEducation: true,
      educationLoanWillingness: false, // Strict NO loan
      maximumComfortableLoanAmount: 0,
      scholarshipDependenceLevel: 'HELPFUL',
      lowCostHighRoiPreferenceWeight: 0.9
    },
    riskPreferences: {
      riskProfile: 'CONSERVATIVE', // Conservative
      sectorPreference: 'GOVERNMENT_ONLY', // Govt only vs student's startup
      emergingCareerAcceptance: 0.1,
      entrepreneurshipAcceptance: 0.0
    },
    geographicConstraints: {
      mobilityLimit: 'SAME_CITY_ONLY', // Same city only vs student's international
      preferredRegions: [],
      importanceOfStayingNearFamily: 0.95
    },
    expectations: {
      expectedTimeToIncome: '3_TO_4_YEARS',
      priorityRanking: []
    },
    nonFinancialConstraints: {
      caregivingDependents: false,
      mandatoryStableEmploymentRequired: true
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  it('exposes transparent individual dimension gaps and flags high conflict areas', () => {
    const result = calculator.calculatePCI(baseStudent, conservativeParent);

    expect(result.compositePCI).toBeGreaterThan(0.5);
    expect(result.compositePCI).toBeLessThanOrEqual(1.0);

    // Gaps must be individually available
    expect(result.dimensionGaps).toHaveProperty('risk_tolerance');
    expect(result.dimensionGaps).toHaveProperty('geographic_mobility');
    expect(result.dimensionGaps).toHaveProperty('sector_preference');
    expect(result.dimensionGaps).toHaveProperty('loan_tolerance');

    // High conflict list flags major divergences
    expect(result.highConflictDimensions).toContain('risk_tolerance');
    expect(result.highConflictDimensions).toContain('geographic_mobility');
    expect(result.highConflictDimensions).toContain('sector_preference');
  });

  it('returns low PCI when parent and student priorities are aligned', () => {
    const alignedParent: ParentProfile = {
      ...conservativeParent,
      fundingWillingness: {
        ...conservativeParent.fundingWillingness,
        educationLoanWillingness: true
      },
      riskPreferences: {
        ...conservativeParent.riskPreferences,
        riskProfile: 'HIGH',
        sectorPreference: 'STARTUP_ACCEPTED'
      },
      geographicConstraints: {
        ...conservativeParent.geographicConstraints,
        mobilityLimit: 'INTERNATIONAL_ALLOWED'
      }
    };

    const result = calculator.calculatePCI(baseStudent, alignedParent);
    expect(result.compositePCI).toBeLessThan(0.25);
    expect(result.highConflictDimensions).toHaveLength(0);
  });
});
