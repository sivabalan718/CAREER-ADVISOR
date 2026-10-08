import { describe, it, expect } from 'vitest';
import { HardConstraintFilter } from '../../engine/src/hard-constraints.js';
import { StudentProfile, ParentProfile, Opportunity } from '@m63/shared';

describe('Hard Constraint Filter — Edge Cases & Invariant Enforcement', () => {
  const filter = new HardConstraintFilter();

  const mockStudent: StudentProfile = {
    id: 'stud_hc_01',
    userId: 'usr_hc_01',
    age: 17,
    isMinor: true,
    educationStage: 'SCHOOL_HIGHER_SECONDARY',
    classOrYear: '12th',
    academicStream: 'SCIENCE_PCM',
    location: { country: 'India', city: 'Chennai' },
    preferredLanguage: 'en',
    academicProfile: { subjects: [], strongestSubjects: [], weakestSubjects: [], academicConsistency: 0.9 },
    aptitude: { logicalReasoning: 80, numericalReasoning: 80, verbalReasoning: 80, abstractReasoning: 80, spatialReasoning: 80, analyticalThinking: 80, problemSolving: 80, isAssessed: true },
    interests: { realistic: 50, investigative: 50, artistic: 50, social: 50, enterprising: 50, conventional: 50 },
    workPreferences: { analyticalVsCreative: 0, individualVsTeam: 0, practicalVsTheoretical: 0, structuredVsFlexible: 0, peopleVsTechnology: 0, routineVsChanging: 0, specialistVsMultidisciplinary: 0 },
    skills: [],
    experiences: [],
    aspirations: { isUndecided: false, preferredIndustries: [], governmentVsPrivate: 'NEUTRAL', higherStudiesIntent: 'NONE_EARN_FIRST', priorityRanking: [] },
    riskAndMobility: {
      willingnessToRelocateDomestic: true,
      willingnessToRelocateInternational: true,
      preferredRegions: [],
      unconventionalCareerAcceptance: 0.5,
      riskTolerance: 0.5,
      educationDurationToleranceYears: 3, // Only 3 years willing to study
      loanWillingness: true,
      maxComfortableLoanAmount: 500000,
      expectedTimeToEarningYears: 3
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const mockParent: ParentProfile = {
    id: 'par_hc_01',
    userId: 'usr_par_01',
    linkedStudentId: 'stud_hc_01',
    relationship: 'FATHER',
    annualIncomeRange: 'INR_6_TO_12_LAKH',
    dependentsCount: 1,
    financialCapacity: {
      householdIncomeBracket: 'INR_6_TO_12_LAKH',
      dependentsCount: 1,
      maximumTotalEducationBudget: 500000,
      maxAnnualAffordableExpense: 150000
    },
    fundingWillingness: {
      willingnessToFundHigherEducation: true,
      educationLoanWillingness: true,
      maximumComfortableLoanAmount: 300000,
      scholarshipDependenceLevel: 'HELPFUL',
      lowCostHighRoiPreferenceWeight: 0.5
    },
    riskPreferences: {
      riskProfile: 'MODERATE',
      sectorPreference: 'NEUTRAL',
      emergingCareerAcceptance: 0.5,
      entrepreneurshipAcceptance: 0.5
    },
    geographicConstraints: {
      mobilityLimit: 'SAME_CITY_ONLY', // Strict same city only
      preferredRegions: ['Chennai'],
      importanceOfStayingNearFamily: 1.0
    },
    expectations: {
      expectedTimeToIncome: '3_TO_4_YEARS',
      priorityRanking: []
    },
    nonFinancialConstraints: {
      caregivingDependents: false,
      mandatoryStableEmploymentRequired: false
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const baseOpportunity: Opportunity = {
    id: 'opp_hc_base',
    title: 'Junior Data Analyst',
    roleCategory: 'Data Analytics',
    description: 'Process structured business data',
    location: { country: 'India', city: 'Chennai' },
    workModel: 'ONSITE',
    compensation: {
      value: { min: 400000, max: 600000, median: 500000, currency: 'INR', period: 'ANNUAL' },
      isAvailable: true,
      evidenceStatus: 'VERIFIED',
      evidenceLevel: 'OFFICIAL_SOURCE',
      confidence: 0.9
    },
    requiredSkills: [],
    riasecProfile: { realistic: 40, investigative: 70, artistic: 20, social: 30, enterprising: 40, conventional: 70 },
    opportunityVector: { riasec: { realistic: 40, investigative: 70, artistic: 20, social: 30, enterprising: 40, conventional: 70 }, technicalDepth: 0.6, interpersonalDemand: 0.4, mathAnalyticalDemand: 0.7, creativeDemand: 0.2, leadershipDemand: 0.2, riskLevel: 0.3 },
    educationRequirements: {
      stage: 'COLLEGE_UNDERGRAD',
      typicalDegrees: ['B.Sc Computer Science'],
      minimumDurationYears: 3,
      estimatedTuitionRange: { min: 200000, max: 200000, currency: 'INR' }
    },
    externalVerificationUrl: 'https://example.com/analyst',
    discoveredAt: new Date().toISOString()
  };

  it('passes when opportunity satisfies all hard financial, age, and location boundaries', () => {
    const result = filter.evaluateConstraints(baseOpportunity, mockStudent, mockParent);
    expect(result.isFeasible).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('fails when minimum legal age requirement is not met', () => {
    const adultOnlyOpp: Opportunity = {
      ...baseOpportunity,
      mandatoryRequirements: {
        minAge: 21 // Student is 17
      }
    };

    const result = filter.evaluateConstraints(adultOnlyOpp, mockStudent, mockParent);
    expect(result.isFeasible).toBe(false);
    expect(result.violations[0]).toContain('Minimum legal eligibility age is 21; candidate current age is 17');
  });

  it('fails when education duration exceeds student tolerance', () => {
    const longDurationOpp: Opportunity = {
      ...baseOpportunity,
      mandatoryRequirements: {
        maxEducationYears: 6 // Student tolerance is 3 years
      }
    };

    const result = filter.evaluateConstraints(longDurationOpp, mockStudent, mockParent);
    expect(result.isFeasible).toBe(false);
    expect(result.violations[0]).toContain('Required education duration (6 years) exceeds student maximum tolerance (3 years)');
  });

  it('fails when opportunity violates strict same-city family restriction', () => {
    const bangaloreOpp: Opportunity = {
      ...baseOpportunity,
      location: { country: 'India', city: 'Bengaluru' } // Different city than Chennai
    };

    const result = filter.evaluateConstraints(bangaloreOpp, mockStudent, mockParent);
    expect(result.isFeasible).toBe(false);
    expect(result.violations[0]).toContain('violates strict family requirement for remaining in Chennai');
  });

  it('fails when mandatory language prerequisite is missing', () => {
    const germanOpp: Opportunity = {
      ...baseOpportunity,
      mandatoryRequirements: {
        requiredLanguages: ['German'] // Student prefers 'en'
      }
    };

    const result = filter.evaluateConstraints(germanOpp, mockStudent, mockParent);
    expect(result.isFeasible).toBe(false);
    expect(result.violations[0]).toContain('Mandatory language prerequisite not met: requires fluency in German');
  });
});
