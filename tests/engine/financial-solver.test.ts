import { describe, it, expect } from 'vitest';
import { FinancialConstraintSolver } from '../../backend/engine/src/financial-solver.js';
import { Opportunity } from '../../backend/shared/src/types/opportunity.js';
import { ParentProfile } from '../../backend/shared/src/types/parent.js';
import { StudentProfile } from '../../backend/shared/src/types/student.js';

describe('Financial Constraint Solver', () => {
  const solver = new FinancialConstraintSolver();

  const mockStudent: StudentProfile = {
    id: 'stud_001',
    userId: 'usr_001',
    age: 18,
    isMinor: false,
    educationStage: 'COLLEGE_UNDERGRAD',
    classOrYear: '12th',
    academicStream: 'SCIENCE_PCM',
    location: { country: 'India' },
    preferredLanguage: 'en',
    academicProfile: { subjects: [], strongestSubjects: [], weakestSubjects: [], academicConsistency: 0.9 },
    aptitude: { logicalReasoning: 80, numericalReasoning: 85, verbalReasoning: 75, abstractReasoning: 80, spatialReasoning: 70, analyticalThinking: 85, problemSolving: 80, isAssessed: true },
    interests: { realistic: 70, investigative: 85, artistic: 40, social: 30, enterprising: 50, conventional: 40 },
    workPreferences: { analyticalVsCreative: -0.5, individualVsTeam: 0.2, practicalVsTheoretical: 0.1, structuredVsFlexible: 0, peopleVsTechnology: -0.6, routineVsChanging: 0.2, specialistVsMultidisciplinary: 0.4 },
    skills: [],
    experiences: [],
    aspirations: { isUndecided: false, preferredIndustries: [], governmentVsPrivate: 'PREFER_PRIVATE', higherStudiesIntent: 'NONE_EARN_FIRST', priorityRanking: ['SALARY', 'SKILL'] },
    riskAndMobility: { willingnessToRelocateDomestic: true, willingnessToRelocateInternational: false, preferredRegions: [], unconventionalCareerAcceptance: 0.5, riskTolerance: 0.5, educationDurationToleranceYears: 4, loanWillingness: false, maxComfortableLoanAmount: 0, expectedTimeToEarningYears: 4 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const mockParent: ParentProfile = {
    id: 'par_001',
    userId: 'usr_par_001',
    linkedStudentId: 'stud_001',
    relationship: 'FATHER',
    annualIncomeRange: 'INR_6_TO_12_LAKH',
    dependentsCount: 2,
    financialCapacity: {
      householdIncomeBracket: 'INR_6_TO_12_LAKH',
      dependentsCount: 2,
      maximumTotalEducationBudget: 500000, // 5 Lakhs hard ceiling
      maxAnnualAffordableExpense: 150000
    },
    fundingWillingness: {
      willingnessToFundHigherEducation: true,
      educationLoanWillingness: false, // Strict NO loan
      maximumComfortableLoanAmount: 0,
      scholarshipDependenceLevel: 'HELPFUL',
      lowCostHighRoiPreferenceWeight: 0.8
    },
    riskPreferences: {
      riskProfile: 'CONSERVATIVE',
      sectorPreference: 'STABLE_PRIVATE',
      emergingCareerAcceptance: 0.4,
      entrepreneurshipAcceptance: 0.1
    },
    geographicConstraints: {
      mobilityLimit: 'DOMESTIC_ANYWHERE',
      preferredRegions: ['South India'],
      importanceOfStayingNearFamily: 0.7
    },
    expectations: {
      expectedTimeToIncome: '3_TO_4_YEARS',
      priorityRanking: ['STABILITY', 'SALARY']
    },
    nonFinancialConstraints: {
      caregivingDependents: false,
      mandatoryStableEmploymentRequired: true
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const mockOpportunity: Opportunity = {
    id: 'opp_eng_01',
    title: 'Software Development Engineer',
    roleCategory: 'Software Engineering',
    description: 'Build enterprise platforms',
    location: { country: 'India', city: 'Bengaluru' },
    workModel: 'HYBRID',
    compensation: {
      value: { min: 800000, max: 1400000, median: 1000000, currency: 'INR', period: 'ANNUAL' },
      isAvailable: true,
      evidenceStatus: 'VERIFIED',
      evidenceLevel: 'OFFICIAL_SOURCE',
      confidence: 0.9
    },
    requiredSkills: [{ name: 'Data Structures', importance: 0.9, category: 'TECHNICAL' }],
    riasecProfile: { realistic: 50, investigative: 85, artistic: 30, social: 20, enterprising: 40, conventional: 60 },
    opportunityVector: { riasec: { realistic: 50, investigative: 85, artistic: 30, social: 20, enterprising: 40, conventional: 60 }, technicalDepth: 0.9, interpersonalDemand: 0.4, mathAnalyticalDemand: 0.8, creativeDemand: 0.3, leadershipDemand: 0.3, riskLevel: 0.3 },
    educationRequirements: {
      stage: 'COLLEGE_UNDERGRAD',
      typicalDegrees: ['B.Tech'],
      minimumDurationYears: 4,
      estimatedTuitionRange: { min: 400000, max: 400000, currency: 'INR' } // Total 4 Lakhs <= 5 Lakhs
    },
    externalVerificationUrl: 'https://careers.example.com',
    discoveredAt: new Date().toISOString()
  };

  it('marks pathway feasible when education cost is within maximum family budget', () => {
    const result = solver.evaluateFeasibility(mockOpportunity, mockParent, mockStudent);
    expect(result.isFeasible).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.paybackPeriodYears).toBe(0.4); // 400,000 / 1,000,000 = 0.4 years
  });

  it('fails hard constraint when tuition exceeds budget and loans are not permitted', () => {
    const expensiveOpportunity: Opportunity = {
      ...mockOpportunity,
      educationRequirements: {
        ...mockOpportunity.educationRequirements,
        estimatedTuitionRange: { min: 1200000, max: 1200000, currency: 'INR' } // 12 Lakhs > 5 Lakhs
      }
    };

    const result = solver.evaluateFeasibility(expensiveOpportunity, mockParent, mockStudent);
    expect(result.isFeasible).toBe(false);
    expect(result.violations[0]).toContain('exceeds maximum family budget');
  });

  it('strictly preserves null for payback period when salary is unknown (never evaluates to 0)', () => {
    const unknownSalaryOpportunity: Opportunity = {
      ...mockOpportunity,
      compensation: {
        value: null,
        isAvailable: false,
        evidenceStatus: 'INSUFFICIENT',
        evidenceLevel: 'SELF_DECLARED',
        confidence: 0.0,
        explanationIfUnavailable: 'Reliable public salary data is currently unavailable for this emerging role.'
      }
    };

    const result = solver.evaluateFeasibility(unknownSalaryOpportunity, mockParent, mockStudent);
    expect(result.isFeasible).toBe(true);
    // Non-negotiable rule: Missing data is NOT zero
    expect(result.paybackPeriodYears).toBeNull();
  });
});
